import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  stranger = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  barber = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const migration = (name: string) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

test("lista de espera e fidelidade: RLS por estabelecimento e papel, contagem no comprovante", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec(
      `create schema extensions;create schema auth;create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema auth to authenticated,service_role;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;set search_path=public,extensions;`,
    );
    for (const name of [
      "20261002035939_studioflow_initial.sql",
      "20261004120000_studioflow_reviews.sql",
      "20261004150000_studioflow_loyalty_waitlist.sql",
    ])
      await db.exec(await migration(name));
    await db.query("insert into auth.users(id)values($1),($2),($3)", [
      owner,
      stranger,
      barber,
    ]);
    await db.exec("set role service_role;");
    const input = {
      name: "Barbearia fiel",
      category: "Barbearia",
      cover: "",
      services: [{ name: "Corte", duration: 40, price: 45 }],
      professionalNames: ["Lucas"],
      openDays: [0, 1, 2, 3, 4, 5, 6],
      openStart: "09:00",
      openEnd: "20:00",
    };
    await db.query("select public.create_workspace($1,$2,$3::jsonb)", [
      owner,
      "loyal-one",
      JSON.stringify(input),
    ]);
    await db.query("select public.create_workspace($1,$2,$3::jsonb)", [
      stranger,
      "loyal-two",
      JSON.stringify(input),
    ]);
    const biz = (
      await db.query<{ id: string; tenant_id: string }>(
        "select id,tenant_id from public.businesses where slug='loyal-one'",
      )
    ).rows[0];
    await db.query(
      "insert into public.business_members(tenant_id,business_id,user_id,role)values($1,$2,$3,'professional')",
      [biz.tenant_id, biz.id, barber],
    );
    const service = (
      await db.query<{ id: string }>(
        "select id from public.services where business_id=$1",
        [biz.id],
      )
    ).rows[0].id;
    // Defaults for the loyalty card.
    const settings = (
      await db.query<{ loyalty_enabled: boolean; loyalty_goal: number }>(
        "select loyalty_enabled,loyalty_goal from public.business_settings where business_id=$1",
        [biz.id],
      )
    ).rows[0];
    assert.deepEqual(settings, { loyalty_enabled: false, loyalty_goal: 10 });
    await assert.rejects(
      db.query(
        "update public.business_settings set loyalty_goal=1 where business_id=$1",
        [biz.id],
      ),
      /check/,
    );

    // Two completed visits plus the current one count on the receipt.
    const day = (offset: number) => {
      const date = new Date(Date.now() + offset * 86400000);
      date.setUTCHours(15, 0, 0, 0);
      return date.toISOString();
    };
    const book = async (offset: number) =>
      (
        await db.query<{ result: { id: string; token: string } }>(
          "select public.book_appointment($1,$2::uuid[],null,$3,$4,$5)as result",
          [biz.id, [service], day(offset), "Matheus Henrique", "62991234567"],
        )
      ).rows[0].result;
    const first = await book(1);
    const second = await book(2);
    const third = await book(3);
    await db.query(
      "update public.appointments set status='completed' where id in ($1,$2)",
      [first.id, second.id],
    );
    const receipt = (
      await db.query<{ result: { loyalty_visits: number } }>(
        "select public.get_booking($1)as result",
        [third.token],
      )
    ).rows[0].result;
    assert.equal(receipt.loyalty_visits, 2);

    await db.query(
      "insert into public.waitlist(tenant_id,business_id,service_id,desired_date,customer_name,customer_phone)values($1,$2,$3,current_date+5,'Ana Clara','11987654321')",
      [biz.tenant_id, biz.id, service],
    );
    await assert.rejects(
      db.query(
        "insert into public.waitlist(tenant_id,business_id,service_id,desired_date,customer_name,customer_phone)values($1,$2,$3,current_date+5,'Ana Clara','11987654321')",
        [biz.tenant_id, biz.id, service],
      ),
      /duplicate key/,
    );
    await assert.rejects(
      db.query(
        "insert into public.waitlist(tenant_id,business_id,service_id,desired_date,customer_name,customer_phone)values($1,$2,$3,current_date+5,'Ana','123')",
        [biz.tenant_id, biz.id, service],
      ),
      /check/,
    );

    const as = async (user: string) => {
      await db.exec("reset role;");
      await db.exec("set role authenticated;");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user,
      ]);
    };
    // Another business sees nothing and changes nothing.
    await as(stranger);
    assert.equal(
      (await db.query("select * from public.waitlist")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("delete from public.waitlist returning id")).rows.length,
      0,
    );
    // A professional reads but cannot handle the list.
    await as(barber);
    assert.equal(
      (await db.query("select * from public.waitlist")).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query(
          "update public.waitlist set status='notified' returning id",
        )
      ).rows.length,
      0,
    );
    // The owner marks as notified and removes; other columns stay closed.
    await as(owner);
    assert.equal(
      (
        await db.query(
          "update public.waitlist set status='notified' returning id",
        )
      ).rows.length,
      1,
    );
    await assert.rejects(
      db.query("update public.waitlist set customer_phone='11999999999'"),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "insert into public.waitlist(tenant_id,business_id,service_id,desired_date,customer_name,customer_phone)values($1,$2,$3,current_date+6,'Bia','11987654322')",
        [biz.tenant_id, biz.id, service],
      ),
      /permission denied/,
    );
    assert.equal(
      (await db.query("delete from public.waitlist returning id")).rows.length,
      1,
    );
    await db.exec("reset role;");
    await db.exec("set role anon;");
    await assert.rejects(
      db.query("select * from public.waitlist"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
