import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { reminderStage, reminderText } from "../src/services/billing";

const DAY = 86_400_000;
const now = new Date("2026-10-05T12:00:00Z");
const access = (days: number | null, extra: object = {}) => ({
  status: "active" as const,
  until: days === null ? null : new Date(now.getTime() + days * DAY).toISOString(),
  price: 149.9,
  plan: "Profissional",
  ...extra,
});

test("lembretes: 3 dias antes, no último dia e depois de vencer, só para quem paga", () => {
  assert.equal(reminderStage(access(2.5), now), "soon");
  assert.equal(reminderStage(access(0.5), now), "today");
  assert.equal(reminderStage(access(-1), now), "late");
  assert.equal(reminderStage(access(-9), now), null);
  assert.equal(reminderStage(access(10), now), null);
  assert.equal(reminderStage(access(null), now), null);
  assert.equal(reminderStage(access(2.5, { price: null }), now), null);
  assert.equal(reminderStage(access(2.5, { status: "suspended" }), now), null);
  const text = reminderText({ stage: "today", owner: "João Pedro", business: "Coliseu", plan: "Profissional", price: 149.9, link: "https://pay.test/x" });
  assert.match(text, /^Oi, João!/);
  assert.match(text, /\*Coliseu\*/);
  assert.match(text, /vence \*hoje\*/);
  assert.match(text, /https:\/\/pay\.test\/x/);
  assert.match(reminderText({ stage: "late", owner: "", business: "Casa", plan: "", price: 99, link: "l" }), /volta na hora/);
});

test("pagamento: libera os dias uma vez só, soma ao prazo e mantém quem é sem prazo", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec(
      `create schema extensions;create schema auth;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema auth to authenticated,service_role;create table auth.users(id uuid primary key,email text,last_sign_in_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;set search_path=public,extensions;`,
    );
    const directory = new URL("../supabase/migrations/", import.meta.url);
    for (const name of (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(name, directory), "utf8"));
    const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.query("insert into auth.users(id,email)values($1,'dono@casa.test')", [owner]);
    await db.exec("set role service_role;");
    await db.query("select public.create_workspace($1,'casa',$2::jsonb)", [
      owner,
      JSON.stringify({ name: "Casa", category: "Barbearia", cover: "", services: [{ name: "Corte", duration: 40, price: 50 }], professionalNames: ["Lucas"], openDays: [1, 2, 3, 4, 5], openStart: "09:00", openEnd: "19:00" }),
    ]);
    const biz = (await db.query<{ id: string }>("select id from public.businesses where slug='casa'")).rows[0].id;
    // Expired 2 days ago: paying counts from now.
    await db.query("update public.platform_access set status='active', access_until=now() - interval '2 days' where business_id=$1", [biz]);
    await db.query("insert into public.platform_invoices(business_id,asaas_charge_id,value,due_date)values($1,'pay_1',149.9,current_date)", [biz]);
    await assert.rejects(
      db.query("insert into public.platform_invoices(business_id,asaas_charge_id,value,due_date)values($1,'pay_2',149.9,current_date)", [biz]),
      "only one open invoice",
    );
    const first = (await db.query<{ v: { access_until: string } }>("select public.platform_invoice_paid('pay_1') as v")).rows[0].v;
    const days = (new Date(first.access_until).getTime() - Date.now()) / DAY;
    assert.ok(days > 29.9 && days < 30.1, `30 dias a partir de agora (${days})`);
    assert.equal((await db.query<{ v: unknown }>("select public.platform_invoice_paid('pay_1') as v")).rows[0].v, null);
    const access = (await db.query<{ status: string }>("select status from public.platform_access where business_id=$1", [biz])).rows[0];
    assert.equal(access.status, "active");
    assert.equal(
      (await db.query<{ n: number }>("select count(*)::int as n from public.platform_access_events where business_id=$1 and action='paid'", [biz])).rows[0].n,
      1,
    );
    // Paid early: adds to what is left.
    await db.query("insert into public.platform_invoices(business_id,asaas_charge_id,value,due_date)values($1,'pay_3',149.9,current_date)", [biz]);
    const second = (await db.query<{ v: { access_until: string } }>("select public.platform_invoice_paid('pay_3') as v")).rows[0].v;
    assert.ok(Math.abs(new Date(second.access_until).getTime() - new Date(first.access_until).getTime() - 30 * DAY) < 60_000);
    // Unlimited stays unlimited.
    await db.query("update public.platform_access set access_until=null where business_id=$1", [biz]);
    await db.query("insert into public.platform_invoices(business_id,asaas_charge_id,value,due_date)values($1,'pay_4',149.9,current_date)", [biz]);
    await db.query("select public.platform_invoice_paid('pay_4')");
    assert.equal((await db.query<{ u: string | null }>("select access_until as u from public.platform_access where business_id=$1", [biz])).rows[0].u, null);
    await db.exec("reset role;set role authenticated;");
    await assert.rejects(db.query("select * from public.platform_invoices"));
    await assert.rejects(db.query("select public.platform_invoice_paid('pay_9')"));
  } finally {
    await db.close();
  }
});
