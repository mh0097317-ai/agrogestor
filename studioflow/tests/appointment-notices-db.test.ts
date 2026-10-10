import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

test("reminder claims enforce consent, cancellation, current time, deduplication and tenant scope", async () => {
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
      "select public.create_workspace($1,'notice-test',$2::jsonb)",
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
        "select id,tenant_id from businesses where slug='notice-test'",
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
      values($1,$2,$3,$4,'Local','11987654321',now()+interval '110 minutes',now()+interval '150 minutes',now()+interval '150 minutes',30,'confirmed',true,decode(repeat('ab',32),'hex')) returning id,start`,
        [b.tenant_id, b.id, pro, customer],
      )
    ).rows[0];
    await db.query(
      "update appointments set created_at=now()-interval '20 minutes' where id=$1",
      [a.id],
    );
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select claim_appointment_notice($1,'customer_reminder',$2)", [
        a.id,
        a.start,
      ]),
      /permission/,
    );
    await assert.rejects(
      db.query("select * from appointment_whatsapp_notices"),
      /permission/,
    );
    await db.exec("reset role; set role service_role");
    await db.query("update appointments set created_at=now() where id=$1", [
      a.id,
    ]);
    assert.equal(
      (await db.query("select * from due_appointment_reminders()")).rows.length,
      0,
      "avoid a reminder immediately after booking",
    );
    await db.query(
      "update appointments set created_at=now()-interval '20 minutes',start=now()+interval '90 minutes' where id=$1",
      [a.id],
    );
    assert.equal(
      (await db.query("select * from due_appointment_reminders()")).rows.length,
      1,
      "recover reminder after the original 15-minute window was missed",
    );
    await db.query("update appointments set start=$2 where id=$1", [
      a.id,
      a.start,
    ]);
    assert.equal(
      (await db.query("select * from due_appointment_reminders()")).rows.length,
      1,
    );
    await db.query("update appointments set reminder=false where id=$1", [
      a.id,
    ]);
    assert.equal(
      (
        await db.query<{ v: boolean }>(
          "select claim_appointment_notice($1,'customer_reminder',$2) v",
          [a.id, a.start],
        )
      ).rows[0].v,
      false,
    );
    await db.query("update professionals set phone='11987654321' where id=$1", [
      pro,
    ]);
    await db.query(
      "insert into whatsapp_links(business_id,tenant_id,instance,status,webhook_token_hash) values($1,$2,$3,'close',decode(repeat('cd',32),'hex'))",
      [b.id, b.tenant_id, `sf-${b.id}`],
    );
    assert.equal(
      (await db.query("select * from due_professional_booking_notices()")).rows
        .length,
      0,
      "wait for the establishment's channel",
    );
    await db.query(
      "update whatsapp_links set status='open' where business_id=$1",
      [b.id],
    );
    assert.equal(
      (await db.query("select * from due_professional_booking_notices()")).rows
        .length,
      1,
      "connected channel recovers recent missed professional notice",
    );
    await db.query(
      "update appointments set created_at=now()-interval '2 days' where id=$1",
      [a.id],
    );
    assert.equal(
      (await db.query("select * from due_professional_booking_notices()")).rows
        .length,
      0,
      "do not replay old history",
    );
    await db.query(
      "update appointments set created_at=now()-interval '20 minutes' where id=$1",
      [a.id],
    );
    const professionalClaims = await Promise.all(
      [1, 2].map(() =>
        db.query<{ v: boolean }>(
          "select claim_appointment_notice($1,'professional_new',$2) v",
          [a.id, a.start],
        ),
      ),
    );
    assert.equal(professionalClaims.filter((r) => r.rows[0].v).length, 1);
    await db.query(
      "update appointment_whatsapp_notices set status='failed' where appointment_id=$1 and kind='professional_new'",
      [a.id],
    );
    assert.equal(
      (await db.query("select * from due_professional_booking_notices()")).rows
        .length,
      0,
      "do not blindly replay a delivery whose outcome may be uncertain",
    );
    await db.exec("reset role;set role authenticated");
    await assert.rejects(
      db.query("select * from due_professional_booking_notices()"),
      /permission/,
    );
    await db.exec("reset role;set role service_role");
    await db.query(
      "update appointments set reminder=true,status='cancelled' where id=$1",
      [a.id],
    );
    assert.equal(
      (
        await db.query<{ v: boolean }>(
          "select claim_appointment_notice($1,'customer_reminder',$2) v",
          [a.id, a.start],
        )
      ).rows[0].v,
      false,
    );
    await db.query("update appointments set status='confirmed' where id=$1", [
      a.id,
    ]);
    const claims = await Promise.all(
      [1, 2].map(() =>
        db.query<{ v: boolean }>(
          "select claim_appointment_notice($1,'customer_reminder',$2) v",
          [a.id, a.start],
        ),
      ),
    );
    assert.equal(claims.filter((r) => r.rows[0].v).length, 1);
    await db.query(
      "update appointments set reminder=false,created_at=now(),booking_channel='public_link' where id=$1",
      [a.id],
    );
    const immediate = await Promise.all(
      [1, 2].map(() =>
        db.query<{ v: boolean }>(
          "select claim_appointment_notice($1,'customer_booking',$2) v",
          [a.id, a.start],
        ),
      ),
    );
    assert.equal(
      immediate.filter((r) => r.rows[0].v).length,
      1,
      "one customer confirmation, independent of future reminder consent",
    );
    await db.query("update appointments set reminder=true where id=$1", [a.id]);
    assert.equal(
      (await db.query("select * from due_appointment_reminders()")).rows.length,
      0,
    );
    const notice = (
      await db.query<{ business_id: string; tenant_id: string }>(
        "select business_id,tenant_id from appointment_whatsapp_notices",
      )
    ).rows[0];
    assert.equal(notice.business_id, b.id);
    assert.equal(notice.tenant_id, b.tenant_id);
    assert.equal(
      (
        await db.query<{ v: boolean }>(
          "select claim_appointment_notice($1,'professional_new',$2) v",
          [a.id, new Date(0).toISOString()],
        )
      ).rows[0].v,
      false,
    );
  } finally {
    await db.close();
  }
});
