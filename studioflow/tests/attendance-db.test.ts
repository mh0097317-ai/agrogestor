import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

test("atendimento sem baixa: pergunta após 15 min, avisa o dono após 2 h e só muda status pela resposta", async () => {
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
    for (const name of (await readdir(dir))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(new URL(name, dir), "utf8"));
    const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.query(
      "insert into auth.users(id,email) values($1,'local@test.invalid')",
      [owner],
    );
    await db.query(
      "select public.create_workspace($1,'attendance-test',$2::jsonb)",
      [
        owner,
        JSON.stringify({
          name: "Local",
          category: "Barbearia",
          services: [{ name: "Corte", duration: 40, price: 30 }],
          professionalNames: ["Profissional"],
          openDays: [0, 1, 2, 3, 4, 5, 6],
          openStart: "08:00",
          openEnd: "20:00",
        }),
      ],
    );
    const b = (
      await db.query<{ id: string; tenant_id: string }>(
        "select id,tenant_id from businesses where slug='attendance-test'",
      )
    ).rows[0];
    const pro = (
      await db.query<{ id: string }>(
        "select id from professionals where business_id=$1",
        [b.id],
      )
    ).rows[0].id;
    await db.query(
      "update business_settings set notifications=true,notify_professionals=true where business_id=$1",
      [b.id],
    );
    const customer = (
      await db.query<{ id: string }>(
        "insert into customers(tenant_id,business_id,name,phone) values($1,$2,'Local','11987654321') returning id",
        [b.tenant_id, b.id],
      )
    ).rows[0].id;
    const a = (
      await db.query<{ id: string; start: string }>(
        `insert into appointments(tenant_id,business_id,professional_id,customer_id,customer_name,customer_phone,start,"end",occupied_end,price,status,reminder,token_hash)
      values($1,$2,$3,$4,'Local','11987654321',now()-interval '5 minutes',now()+interval '35 minutes',now()+interval '35 minutes',30,'confirmed',true,decode(repeat('ab',32),'hex')) returning id,start`,
        [b.tenant_id, b.id, pro, customer],
      )
    ).rows[0];
    await db.query("update professionals set phone='11987654321' where id=$1", [pro]);
    await db.query(
      "insert into whatsapp_links(business_id,tenant_id,instance,status,webhook_token_hash) values($1,$2,$3,'open',decode(repeat('cd',32),'hex'))",
      [b.id, b.tenant_id, `sf-${b.id}`],
    );
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from due_attendance_checks()"), /permission/);
    await assert.rejects(db.query("select settle_attendance($1,'completed')", [a.id]), /permission/);
    await db.exec("reset role; set role service_role");
    const due = async () => (await db.query("select * from due_attendance_checks()")).rows.length;
    const claim = async (kind: string, start: string) =>
      (await db.query<{ v: boolean }>("select claim_appointment_notice($1,$2,$3) v", [a.id, kind, start])).rows[0].v;
    assert.equal(await due(), 0, "ainda dentro dos 15 minutos");
    assert.equal(await claim("professional_checkup", a.start), false);
    const late = (
      await db.query<{ start: string }>(
        "update appointments set start=now()-interval '20 minutes',\"end\"=now()+interval '20 minutes',occupied_end=now()+interval '20 minutes' where id=$1 returning start",
        [a.id],
      )
    ).rows[0].start;
    assert.equal(await due(), 1);
    await db.query("update business_settings set attendance_check=false where business_id=$1", [b.id]);
    assert.equal(await due(), 0, "o dono desligou a pergunta");
    await db.query("update business_settings set attendance_check=true where business_id=$1", [b.id]);
    assert.equal(await claim("professional_checkup", late), true);
    assert.equal(await claim("professional_checkup", late), false, "pergunta só uma vez");
    assert.equal(await due(), 0);
    const owners = async () => (await db.query("select * from due_unsettled_owner_alerts()")).rows.length;
    await db.query(
      "update appointment_whatsapp_notices set status='sent',sent_at=now()-interval '1 hour' where appointment_id=$1",
      [a.id],
    );
    assert.equal(await owners(), 0, "espera 2 horas pela resposta");
    await db.query(
      "update appointment_whatsapp_notices set sent_at=now()-interval '3 hours' where appointment_id=$1 and kind='professional_checkup'",
      [a.id],
    );
    assert.equal(await owners(), 1);
    assert.equal(await claim("owner_unsettled", late), true);
    assert.equal(await owners(), 0, "o dono recebe uma vez");
    const settle = async (status: string) =>
      (await db.query<{ v: string | null }>("select settle_attendance($1,$2) v", [a.id, status])).rows[0].v;
    assert.equal(await settle("cancelled"), null, "só atendi, atendendo ou falta");
    assert.equal(await settle("in_progress"), "in_progress");
    assert.equal(await settle("in_progress"), null);
    assert.equal(await settle("completed"), "completed");
    assert.equal(await settle("no_show"), null, "baixa feita não volta pelo link");
    const visits = (
      await db.query<{ visits: number }>("select visits from customers where id=$1", [customer])
    ).rows[0].visits;
    assert.equal(visits, 1);
  } finally {
    await db.close();
  }
});
