import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  barber = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  stranger = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const migration = (name: string) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

test("produtos: venda dá baixa no estoque, nunca deixa negativo e cancela devolvendo", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec(
      `create schema extensions;create schema auth;create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema auth to authenticated,service_role;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;set search_path=public,extensions;`,
    );
    for (const name of [
      "20261002035939_studioflow_initial.sql",
      "20261004120000_studioflow_reviews.sql",
      "20261004150000_studioflow_loyalty_waitlist.sql",
      "20261005120000_studioflow_payments.sql",
      "20261006120000_studioflow_assistant.sql",
      "20261008120000_studioflow_products.sql",
    ])
      await db.exec(await migration(name));
    await db.query("insert into auth.users(id)values($1),($2),($3)", [
      owner,
      barber,
      stranger,
    ]);
    await db.exec("set role service_role;");
    const input = JSON.stringify({
      name: "Barbearia",
      category: "Barbearia",
      cover: "",
      services: [{ name: "Corte", duration: 40, price: 50 }],
      professionalNames: ["Lucas"],
      openDays: [1, 2, 3, 4, 5, 6],
      openStart: "09:00",
      openEnd: "19:00",
    });
    await db.query("select public.create_workspace($1,'loja-um',$2::jsonb)", [owner, input]);
    await db.query("select public.create_workspace($1,'loja-dois',$2::jsonb)", [stranger, input]);
    const biz = (
      await db.query<{ id: string; tenant_id: string }>(
        "select id,tenant_id from public.businesses where slug='loja-um'",
      )
    ).rows[0];
    await db.query(
      "insert into public.business_members(tenant_id,business_id,user_id,role)values($1,$2,$3,'professional')",
      [biz.tenant_id, biz.id, barber],
    );
    const product = (
      await db.query<{ id: string }>(
        "insert into public.products(tenant_id,business_id,name,price,stock)values($1,$2,'Pomada matte',45,3) returning id",
        [biz.tenant_id, biz.id],
      )
    ).rows[0].id;
    const oil = (
      await db.query<{ id: string }>(
        "insert into public.products(tenant_id,business_id,name,price,stock)values($1,$2,'Óleo de barba',30,10) returning id",
        [biz.tenant_id, biz.id],
      )
    ).rows[0].id;
    const sell = (user: string, items: unknown[], extra: Record<string, unknown> = {}) =>
      db.query<{ sale: { id: string; total: string; items: unknown[] } }>(
        "select public.sell_products($1,$2,$3::jsonb) as sale",
        [biz.id, user, JSON.stringify({ items, method: "pix", ...extra })],
      );
    const stock = async (id: string) =>
      (await db.query<{ stock: number }>("select stock from public.products where id=$1", [id]))
        .rows[0].stock;

    const sale = (
      await sell(owner, [
        { productId: product, quantity: 2 },
        { productId: oil, quantity: 1 },
      ], { customerName: "Cliente balcão" })
    ).rows[0].sale;
    assert.equal(Number(sale.total), 120);
    assert.equal(await stock(product), 1);
    assert.equal(await stock(oil), 9);

    // Asking for more than there is fails and changes nothing.
    await assert.rejects(
      sell(owner, [
        { productId: oil, quantity: 1 },
        { productId: product, quantity: 2 },
      ]),
      /insufficient stock/,
    );
    assert.equal(await stock(product), 1);
    assert.equal(await stock(oil), 9);
    // Professionals only read; strangers are not members.
    await assert.rejects(sell(barber, [{ productId: oil, quantity: 1 }]), /forbidden/);
    await assert.rejects(sell(stranger, [{ productId: oil, quantity: 1 }]), /forbidden/);
    await assert.rejects(sell(owner, [{ productId: oil, quantity: 0 }]), /invalid quantity/);

    // Cancelling returns the items once.
    await db.query("select public.cancel_product_sale($1,$2,$3)", [biz.id, owner, sale.id]);
    await db.query("select public.cancel_product_sale($1,$2,$3)", [biz.id, owner, sale.id]);
    assert.equal(await stock(product), 3);
    assert.equal(await stock(oil), 10);
    await assert.rejects(
      db.query("select public.cancel_product_sale($1,$2,$3)", [biz.id, barber, sale.id]),
      /forbidden/,
    );

    // RLS: members read their own products; nobody writes directly.
    await db.exec("reset role;set role authenticated;");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    assert.equal((await db.query("select * from public.products")).rows.length, 2);
    assert.equal((await db.query("select * from public.product_sales")).rows.length, 1);
    await assert.rejects(db.query("update public.products set stock=999"));
    await assert.rejects(
      db.query("select public.sell_products($1,$2,'{}'::jsonb)", [biz.id, owner]),
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [stranger]);
    assert.equal((await db.query("select * from public.products")).rows.length, 0);
  } finally {
    await db.close();
  }
});
