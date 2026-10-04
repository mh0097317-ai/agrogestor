import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const migration = (name: string) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

test("check-in: só hoje, perto do horário, uma vez, pelo comprovante ou pelo WhatsApp", async () => {
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
      "20261008130000_studioflow_checkin.sql",
    ])
      await db.exec(await migration(name));
    await db.query("insert into auth.users(id)values($1)", [owner]);
    await db.exec("set role service_role;");
    await db.query("select public.create_workspace($1,'casa',$2::jsonb)", [
      owner,
      JSON.stringify({
        name: "Casa",
        category: "Barbearia",
        cover: "",
        services: [{ name: "Corte", duration: 40, price: 50 }],
        professionalNames: ["Lucas Henrique"],
        openDays: [0, 1, 2, 3, 4, 5, 6],
        openStart: "00:00",
        openEnd: "23:59",
      }),
    ]);
    const biz = (
      await db.query<{ id: string; tenant_id: string; person: string }>(
        "select b.id,b.tenant_id,(select id from public.professionals where business_id=b.id) as person from public.businesses b where slug='casa'",
      )
    ).rows[0];
    const customer = (
      await db.query<{ id: string }>(
        "insert into public.customers(tenant_id,business_id,name,phone)values($1,$2,'Rafael Souza','11987654321') returning id",
        [biz.tenant_id, biz.id],
      )
    ).rows[0].id;
    const book = async (startOffset: string, token: string) => {
      const hash = createHash("sha256").update(token).digest("hex");
      await db.query(
        `insert into public.appointments(tenant_id,business_id,customer_id,professional_id,customer_name,customer_phone,"start","end",occupied_end,price,token_hash)
         values($1,$2,$3,$4,'Rafael Souza','11987654321',now()+$5::interval,now()+$5::interval+interval '40 minutes',now()+$5::interval+interval '40 minutes',50,decode($6,'hex'))`,
        [biz.tenant_id, biz.id, customer, biz.person, startOffset, hash],
      );
    };
    const soon = "a".repeat(64),
      later = "b".repeat(64);
    await book("30 minutes", soon);
    await book("2 days", later);

    const first = (
      await db.query<{ value: { customer: string; professional: string; checked_in_at: string } }>(
        "select public.check_in_by_token($1) as value",
        [soon],
      )
    ).rows[0].value;
    assert.equal(first.customer, "Rafael");
    assert.equal(first.professional, "Lucas");
    assert.ok(first.checked_in_at);
    // A second scan keeps the first arrival time.
    const again = (
      await db.query<{ value: { checked_in_at: string } }>(
        "select public.check_in_by_phone($1,'11987654321') as value",
        [biz.id],
      )
    ).rows[0].value;
    assert.equal(again.checked_in_at, first.checked_in_at);
    // Too early for the visit in two days; unknown phone or token says nothing.
    await assert.rejects(db.query("select public.check_in_by_token($1)", [later]), /outside window/);
    await assert.rejects(
      db.query("select public.check_in_by_phone($1,'11900000000')", [biz.id]),
      /unknown booking/,
    );
    await assert.rejects(db.query("select public.check_in_by_token('nope')"), /unknown booking/);
    await db.query("update public.appointments set status='cancelled' where checked_in_at is null");
    await assert.rejects(db.query("select public.check_in_by_token($1)", [later]), /not checkable/);
    // Visitors and members cannot call it directly.
    await db.exec("reset role;set role anon;");
    await assert.rejects(db.query("select public.check_in_by_token($1)", [soon]));
  } finally {
    await db.close();
  }
});
