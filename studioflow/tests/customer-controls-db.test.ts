import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

test("cofre, conexões individuais e mensalidades: RLS, escopo, auditoria e renovação idempotente", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  const admin = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  try {
    await db.exec(
      `create schema extensions;create schema auth;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema auth to authenticated,service_role;create table auth.users(id uuid primary key,email text,last_sign_in_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;set search_path=public,extensions;`,
    );
    const directory = new URL("../supabase/migrations/", import.meta.url);
    for (const file of (await readdir(directory))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(new URL(file, directory), "utf8"));
    await db.query("insert into auth.users(id) values($1),($2)", [
      admin,
      other,
    ]);
    await db.exec("set role service_role");
    const setup = JSON.stringify({
      name: "Loja",
      category: "Barbearia",
      cover: "",
      services: [{ name: "Corte", duration: 40, price: 50 }],
      professionalNames: ["Lucas"],
      openDays: [0, 1, 2, 3, 4, 5, 6],
      openStart: "09:00",
      openEnd: "20:00",
    });
    for (const [id, slug] of [
      [admin, "one"],
      [other, "two"],
    ])
      await db.query("select public.create_workspace($1,$2,$3::jsonb)", [
        id,
        slug,
        setup,
      ]);
    const businesses = (
      await db.query<{ id: string; tenant_id: string }>(
        "select id,tenant_id from public.businesses order by slug",
      )
    ).rows;
    const [one, two] = businesses;
    await db.query("insert into public.platform_admins(user_id) values($1)", [
      admin,
    ]);
    await assert.rejects(
      db.query(
        "select public.platform_save_ai_key($1,$2,'anthropic','model','sealed','abcd')",
        [one.id, other],
      ),
      /forbidden/,
    );
    await db.query(
      "select public.platform_save_ai_key($1,$2,'anthropic','model','sealed','abcd')",
      [one.id, admin],
    );
    assert.equal(
      (
        await db.query(
          "select 1 from public.business_ai_credentials where business_id=$1",
          [two.id],
        )
      ).rows.length,
      0,
    );
    const pro = (
      await db.query<{ id: string }>(
        "select id from public.professionals where business_id=$1",
        [one.id],
      )
    ).rows[0].id;
    await assert.rejects(
      db.query(
        "insert into public.professional_whatsapp_links(business_id,tenant_id,professional_id,instance,webhook_token_hash) values($1,$2,$3,'sf-pro-test',decode('aa','hex'))",
        [two.id, two.tenant_id, pro],
      ),
      /foreign key/,
    );
    await db.query(
      "insert into public.professional_whatsapp_links(business_id,tenant_id,professional_id,instance,webhook_token_hash) values($1,$2,$3,'sf-pro-test',decode('aa','hex'))",
      [one.id, one.tenant_id, pro],
    );
    for (const professional of [null, pro])
      await db.query(
        "insert into public.conversations(business_id,tenant_id,channel,contact_phone,whatsapp_professional_id) values($1,$2,'whatsapp','11987654321',$3)",
        [one.id, one.tenant_id, professional],
      );
    assert.equal(
      (
        await db.query(
          "select 1 from public.conversations where business_id=$1",
          [one.id],
        )
      ).rows.length,
      2,
    );
    await assert.rejects(
      db.query(
        "insert into public.conversations(business_id,tenant_id,channel,contact_phone,whatsapp_professional_id) values($1,$2,'whatsapp','11987654321',$3)",
        [one.id, one.tenant_id, pro],
      ),
      /unique/,
    );
    await db.query(
      "select public.platform_save_assistant($1,$2,true,'Recepção','Atender com educação',100)",
      [one.id, admin],
    );
    await db.query(
      "select public.platform_set_plan($1,$2,'Essencial',79,'{}'::text[])",
      [one.id, admin],
    );
    await assert.rejects(
      db.query(
        "select public.platform_save_assistant($1,$2,true,'Recepção','',100)",
        [one.id, admin],
      ),
      /module not enabled/,
    );
    await db.exec(
      "update public.platform_access set status='pending',access_until=null",
    );
    const invoice = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    for (let i = 0; i < 2; i++)
      await db.query(
        "select public.platform_manual_billing($1,$2,'create',$3,79,'2026-10-07','pix','Mensalidade',30)",
        [one.id, admin, invoice],
      );
    assert.equal(
      (await db.query("select * from public.platform_manual_invoices")).rows
        .length,
      1,
    );
    await assert.rejects(
      db.query(
        "select public.platform_manual_billing($1,$2,'pay',$3,p_paid_at=>now(),p_renew=>true)",
        [two.id, admin, invoice],
      ),
      /invoice not found/,
    );
    await assert.rejects(
      db.query(
        "select public.platform_manual_billing($1,$2,'pay',$3,p_paid_at=>now()+interval '1 day',p_renew=>true)",
        [one.id, admin, invoice],
      ),
      /invalid payment date/,
    );
    await db.query(
      "select public.platform_manual_billing($1,$2,'pay',$3,p_paid_at=>now(),p_renew=>true)",
      [one.id, admin, invoice],
    );
    const until = async () =>
      (
        await db.query<{ access_until: string }>(
          "select access_until from public.platform_access where business_id=$1",
          [one.id],
        )
      ).rows[0].access_until;
    const first = await until();
    assert.ok(first);
    await db.query(
      "select public.platform_manual_billing($1,$2,'pay',$3,p_paid_at=>now(),p_renew=>true)",
      [one.id, admin, invoice],
    );
    assert.equal(String(await until()), String(first));
    assert.equal(
      (
        await db.query(
          "select 1 from public.platform_config_events where action='manual_invoice_paid'",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from public.platform_access where business_id=$1",
          [two.id],
        )
      ).rows[0].status,
      "pending",
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      for (const table of [
        "business_ai_credentials",
        "platform_integrations",
        "platform_config_events",
        "professional_whatsapp_links",
        "platform_manual_invoices",
      ])
        await assert.rejects(
          db.query(`select * from public.${table}`),
          /permission denied/,
        );
      await assert.rejects(
        db.query(
          "select public.platform_save_ai_key($1,$2,null,null,null,null)",
          [one.id, admin],
        ),
        /permission denied/,
      );
    }
  } finally {
    await db.close();
  }
});
