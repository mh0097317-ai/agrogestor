import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { appointmentEmail } from "../src/services/email/appointment-email";
import type { Appointment, Store } from "../src/types";

test("e-mail: confirmação e véspera, uma vez só, só com e-mail e com aviso ligado", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec(`create schema extensions;create schema auth;create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create role anon;create role authenticated;create role service_role bypassrls;
      grant usage on schema auth to authenticated,service_role;
      create table auth.users(id uuid primary key,email text,last_sign_in_at timestamptz,raw_user_meta_data jsonb default '{}');
      create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      set search_path=public,extensions;`);
    const dir = new URL("../supabase/migrations/", import.meta.url);
    for (const name of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(name, dir), "utf8"));
    const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.query("insert into auth.users(id,email) values($1,'dono@test.invalid')", [owner]);
    await db.query("select public.create_workspace($1,'email-test',$2::jsonb)", [
      owner,
      JSON.stringify({
        name: "Casa",
        category: "Barbearia",
        services: [{ name: "Corte", duration: 40, price: 30 }],
        professionalNames: ["Lucas"],
        openDays: [0, 1, 2, 3, 4, 5, 6],
        openStart: "08:00",
        openEnd: "20:00",
      }),
    ]);
    const b = (await db.query<{ id: string; tenant_id: string }>(
      "select id,tenant_id from businesses where slug='email-test'",
    )).rows[0];
    const pro = (await db.query<{ id: string }>(
      "select id from professionals where business_id=$1", [b.id],
    )).rows[0].id;
    const customer = (await db.query<{ id: string }>(
      "insert into customers(tenant_id,business_id,name,phone,email) values($1,$2,'Ana Souza','11987654321','ana@exemplo.com') returning id",
      [b.tenant_id, b.id],
    )).rows[0].id;
    const a = (await db.query<{ id: string; start: string }>(
      `insert into appointments(tenant_id,business_id,professional_id,customer_id,customer_name,customer_phone,start,"end",occupied_end,price,status,reminder,token_hash)
       values($1,$2,$3,$4,'Ana Souza','11987654321',now()+interval '24 hours',now()+interval '25 hours',now()+interval '25 hours',30,'confirmed',false,decode(repeat('ab',32),'hex')) returning id,start`,
      [b.tenant_id, b.id, pro, customer],
    )).rows[0];
    const due = async () =>
      (await db.query<{ kind: string; email: string }>("select kind,email from due_email_notices() order by kind")).rows;

    await db.exec("set role anon");
    await assert.rejects(db.query("select * from due_email_notices()"), /permission/);
    await assert.rejects(db.query("select * from appointment_email_notices"), /permission/);
    await db.exec("reset role; set role service_role");

    assert.deepEqual(await due(), [], "acabou de marcar: espera alguns minutos");
    await db.query("update appointments set created_at=now()-interval '10 minutes' where id=$1", [a.id]);
    assert.deepEqual((await due()).map((r) => r.kind), ["confirmation"], "véspera só para quem marcou antes");
    await db.query("update appointments set created_at=now()-interval '7 hours' where id=$1", [a.id]);
    assert.deepEqual((await due()).map((r) => r.kind), ["confirmation", "day_before"]);
    assert.equal((await due())[0].email, "ana@exemplo.com");

    const claim = async (kind: string) =>
      (await db.query<{ v: boolean }>("select claim_email_notice($1,$2,$3) v", [a.id, kind, a.start])).rows[0].v;
    assert.equal(await claim("day_before"), true);
    assert.equal(await claim("day_before"), false, "nunca duas vezes");
    assert.deepEqual((await due()).map((r) => r.kind), ["confirmation"]);

    await db.query("update business_settings set email_notices=false where business_id=$1", [b.id]);
    assert.deepEqual(await due(), [], "o dono desligou");
    assert.equal(await claim("confirmation"), false);
    await db.query("update business_settings set email_notices=true where business_id=$1", [b.id]);

    await db.query("update appointments set status='cancelled' where id=$1", [a.id]);
    assert.deepEqual(await due(), [], "cancelado não recebe");
    await db.query("update appointments set status='confirmed' where id=$1", [a.id]);

    await db.query("update customers set email=null where id=$1", [customer]);
    assert.deepEqual(await due(), [], "sem e-mail não há envio");
  } finally {
    await db.close();
  }
});

test("e-mail: conteúdo escapa HTML e não leva token", () => {
  const store = {
    business: { id: "b", tenantId: "t", slug: "casa", name: "Casa <b>", category: "", description: "", address: "Rua 1", phone: "11 99999-0000", instagram: "", cover: "", amenities: [], color: "#7A5626" },
    services: [{ id: "s", name: "Corte & barba" }],
    professionals: [{ id: "p", name: "Lucas" }],
  } as unknown as Store;
  const appointment = {
    id: "a", businessId: "b", customerName: "Ana Souza", serviceIds: ["s"], professionalId: "p",
    start: "2026-10-20T17:00:00.000Z", status: "confirmed", price: 50, token: "segredo",
  } as unknown as Appointment;
  const email = appointmentEmail("day_before", store, appointment, "ana@exemplo.com");
  assert.match(email.subject, /Amanhã/);
  assert.match(email.html, /Casa &lt;b&gt;/);
  assert.match(email.html, /Corte &amp; barba/);
  assert.match(email.text, /14:00/);
  assert.doesNotMatch(email.html + email.text, /segredo/);
});
