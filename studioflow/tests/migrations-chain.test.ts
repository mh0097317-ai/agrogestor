import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("migrations: todas em sequência, como no Supabase, e o Instagram nas conversas", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec(
      `create schema extensions;create schema auth;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema auth to authenticated,service_role;create table auth.users(id uuid primary key,email text,last_sign_in_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;set search_path=public,extensions;`,
    );
    const directory = new URL("../supabase/migrations/", import.meta.url);
    const files = (await readdir(directory))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    assert.ok(files.length >= 10);
    for (const name of files)
      await db.exec(await readFile(new URL(name, directory), "utf8"));

    await db.query(
      "insert into auth.users(id,email)values($1,'dono@casa.test')",
      [owner],
    );
    await db.exec("set role service_role;");
    await db.query("select public.create_workspace($1,'casa',$2::jsonb)", [
      owner,
      JSON.stringify({
        name: "Casa",
        category: "Barbearia",
        cover: "",
        services: [{ name: "Corte", duration: 40, price: 50 }],
        professionalNames: ["Lucas"],
        openDays: [1, 2, 3, 4, 5, 6],
        openStart: "09:00",
        openEnd: "19:00",
      }),
    ]);
    const biz = (
      await db.query<{ id: string; tenant_id: string }>(
        "select id,tenant_id from public.businesses where slug='casa'",
      )
    ).rows[0];
    // New sign-ups wait for the platform to release them.
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from public.platform_access where business_id=$1",
          [biz.id],
        )
      ).rows[0].status,
      "pending",
    );
    // Plan and modules picked for the client.
    const planned = (
      await db.query<{
        value: { modules: string[]; plan: string; monthly_price: string };
      }>(
        "select public.platform_set_plan($1,null,'Profissional',149.9,array['produtos','clube','produtos']) as value",
        [biz.id],
      )
    ).rows[0].value;
    assert.deepEqual(planned.modules, ["clube", "produtos"]);
    assert.equal(Number(planned.monthly_price), 149.9);
    await assert.rejects(
      db.query(
        "select public.platform_set_plan($1,null,'X',null,array['teletransporte'])",
        [biz.id],
      ),
    );
    const overview = (
      await db.query<{ value: { plan: string; modules: string[] } }>(
        "select value from public.platform_overview() as value",
      )
    ).rows[0].value;
    assert.equal(overview.plan, "Profissional");
    const insert = (ref: string) =>
      db.query(
        "insert into public.conversations(tenant_id,business_id,channel,contact_ref)values($1,$2,'instagram',$3)",
        [biz.tenant_id, biz.id, ref],
      );
    await insert("900001");
    await assert.rejects(insert("900001"));
    await insert("900002");
    await assert.rejects(
      db.query(
        "insert into public.conversations(tenant_id,business_id,channel)values($1,$2,'telegram')",
        [biz.tenant_id, biz.id],
      ),
    );
    // Up to two extra photos per service, besides the main one.
    await db.query(
      "update public.services set photos=array['/a.jpg','/b.jpg'] where business_id=$1",
      [biz.id],
    );
    await assert.rejects(
      db.query(
        "update public.services set photos=array['/a.jpg','/b.jpg','/c.jpg'] where business_id=$1",
        [biz.id],
      ),
    );
    await db.query(
      "update public.businesses set maps_url='https://maps.app.goo.gl/x' where id=$1",
      [biz.id],
    );
    await db.query(
      "insert into public.instagram_feeds(business_id,tenant_id,ig_user_id,username,access_token_enc)values($1,$2,'1789000000','casa','x')",
      [biz.id, biz.tenant_id],
    );
    await db.query(
      "insert into public.whatsapp_links(business_id,tenant_id,instance,webhook_token_hash)values($1,$2,$3,'\\x00')",
      [biz.id, biz.tenant_id, `sf-${biz.id}`],
    );
    await assert.rejects(
      db.query(
        "update public.whatsapp_links set status='perdido' where business_id=$1",
        [biz.id],
      ),
    );
    assert.equal(
      (
        await db.query<{ v: boolean }>(
          "select notify_professionals as v from public.business_settings where business_id=$1",
          [biz.id],
        )
      ).rows[0].v,
      true,
    );
    // Recovery is durable, excludes exhausted attempts, and does not let an
    // internal retry event bypass the next-attempt delay.
    await db.query(
      "update public.business_settings set assistant_enabled=true where business_id=$1",
      [biz.id],
    );
    const pending = (
      await db.query<{ id: string }>(
        "insert into public.conversations(tenant_id,business_id,channel,contact_phone,ai_cursor)values($1,$2,'whatsapp','11987654321',now()-interval '2 minutes') returning id",
        [biz.tenant_id, biz.id],
      )
    ).rows[0];
    const incoming = (
      await db.query<{ created_at: string }>(
        "insert into public.conversation_messages(tenant_id,business_id,conversation_id,role,body,created_at)values($1,$2,$3,'customer','Queria saber os horários disponíveis?',now()-interval '1 minute') returning created_at",
        [biz.tenant_id, biz.id, pending.id],
      )
    ).rows[0];
    assert.equal(
      (await db.query("select * from public.due_assistant_conversations()"))
        .rows.length,
      1,
    );
    assert.equal(
      (
        await db.query<{ v: number }>(
          "select public.start_assistant_run($1,$2) as v",
          [pending.id, incoming.created_at],
        )
      ).rows[0].v,
      1,
    );
    await db.query(
      "update public.assistant_runs set state='RETRY',retry_at=now()+interval '1 minute' where conversation_id=$1",
      [pending.id],
    );
    await db.query(
      "insert into public.conversation_messages(tenant_id,business_id,conversation_id,role,body)values($1,$2,$3,'event','retry diagnostic')",
      [biz.tenant_id, biz.id, pending.id],
    );
    assert.equal(
      (await db.query("select * from public.due_assistant_conversations()"))
        .rows.length,
      0,
    );
    await db.query("select public.start_assistant_run($1,$2)", [
      pending.id,
      incoming.created_at,
    ]);
    await db.query("select public.start_assistant_run($1,$2)", [
      pending.id,
      incoming.created_at,
    ]);
    await db.query(
      "update public.assistant_runs set state='RETRY',retry_at=now()-interval '1 minute' where conversation_id=$1",
      [pending.id],
    );
    assert.equal(
      (await db.query("select * from public.due_assistant_conversations()"))
        .rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "update public.assistant_runs set tenant_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where conversation_id=$1",
        [pending.id],
      ),
    );
    await assert.rejects(
      db.query(
        "insert into public.business_transcription_credentials(business_id,tenant_id,provider,model,secret_enc,key_hint)values($1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','groq','whisper-large-v3-turbo','sealed','abcd')",
        [biz.id],
      ),
    );
    // Manual analysis can reopen exhausted/closed work, but not reset quota,
    // interrupt another worker, cross tenants or repeat an answered request.
    const analyze = async (businessId = biz.id) =>
      (
        await db.query<{ v: string }>(
          "select public.request_assistant_analysis($1,$2) as v",
          [businessId, pending.id],
        )
      ).rows[0].v;
    assert.equal(
      await analyze("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
      "not-found",
    );
    await db.query(
      "update public.conversations set status='closed' where id=$1",
      [pending.id],
    );
    await db.query(
      "insert into public.assistant_usage(business_id,day,turns,input_tokens,output_tokens) values($1,(now() at time zone 'America/Sao_Paulo')::date,7,111,22)",
      [biz.id],
    );
    assert.equal(await analyze(), "queued");
    assert.equal(await analyze(), "busy");
    const queued = (
      await db.query<{
        attempts: number;
        state: string;
        status: string;
        ai_cursor: string;
      }>(
        "select r.attempts,r.state,c.status,c.ai_cursor from public.assistant_runs r join public.conversations c on c.id=r.conversation_id where c.id=$1",
        [pending.id],
      )
    ).rows[0];
    assert.equal(queued.attempts, 0);
    assert.equal(queued.state, "RETRY");
    assert.equal(queued.status, "ai");
    assert.equal(
      (
        await db.query<{ v: boolean }>(
          "select c.ai_cursor=(select min(created_at) from public.conversation_messages where conversation_id=c.id and role='customer')-interval '1 millisecond' as v from public.conversations c where c.id=$1",
          [pending.id],
        )
      ).rows[0].v,
      true,
    );
    assert.equal(
      (
        await db.query<{ turns: number }>(
          "select turns from public.assistant_usage where business_id=$1",
          [biz.id],
        )
      ).rows[0].turns,
      7,
    );
    assert.equal(
      (await db.query("select * from public.due_assistant_conversations()"))
        .rows.length,
      1,
    );
    assert.equal(
      (
        await db.query<{ v: number }>(
          "select public.start_assistant_run($1,$2) as v",
          [pending.id, incoming.created_at],
        )
      ).rows[0].v,
      1,
    );
    await db.query("select public.conversation_lease($1)", [pending.id]);
    assert.equal(await analyze(), "busy");
    await db.query(
      "update public.conversations set processing_until=null where id=$1",
      [pending.id],
    );
    await db.query(
      "update public.assistant_runs set state='SENDING' where conversation_id=$1",
      [pending.id],
    );
    assert.equal(await analyze(), "delivery-unconfirmed");
    await db.query(
      "update public.assistant_runs set state='FAILED',error_code='delivery-unconfirmed' where conversation_id=$1",
      [pending.id],
    );
    assert.equal(await analyze(), "delivery-unconfirmed");
    await db.query(
      "update public.assistant_runs set error_code=null where conversation_id=$1",
      [pending.id],
    );
    await db.query(
      "update public.business_settings set assistant_enabled=false where business_id=$1",
      [biz.id],
    );
    assert.equal(await analyze(), "disabled");
    await db.query(
      "update public.business_settings set assistant_enabled=true,assistant_daily_limit=10 where business_id=$1",
      [biz.id],
    );
    await db.query(
      "update public.assistant_usage set turns=10 where business_id=$1",
      [biz.id],
    );
    assert.equal(await analyze(), "daily-limit");
    assert.equal(
      (
        await db.query<{ attempts: number }>(
          "select attempts from public.assistant_runs where conversation_id=$1",
          [pending.id],
        )
      ).rows[0].attempts,
      1,
    );
    await db.query(
      "update public.assistant_usage set turns=7 where business_id=$1",
      [biz.id],
    );
    const customerId = (
      await db.query<{ id: string }>(
        "insert into public.customers(tenant_id,business_id,name,phone)values($1,$2,'Ana','11987654321') returning id",
        [biz.tenant_id, biz.id],
      )
    ).rows[0].id;
    const professionalId = (
      await db.query<{ id: string }>(
        "select id from public.professionals where business_id=$1 limit 1",
        [biz.id],
      )
    ).rows[0].id;
    await db.query(
      `insert into public.appointments(tenant_id,business_id,customer_id,professional_id,customer_name,customer_phone,"start","end",occupied_end,price,conversation_id) values($1,$2,$3,$4,'Ana','11987654321',now()+interval '1 day',now()+interval '1 day 40 minutes',now()+interval '1 day 40 minutes',50,$5)`,
      [biz.tenant_id, biz.id, customerId, professionalId, pending.id],
    );
    assert.equal(await analyze(), "appointment-created");
    await db.query(
      "insert into public.conversation_messages(tenant_id,business_id,conversation_id,role,body)values($1,$2,$3,'staff','O corte custa R$50.')",
      [biz.tenant_id, biz.id, pending.id],
    );
    assert.equal(await analyze(), "answered");
    await db.exec("reset role;set role authenticated;");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    await assert.rejects(db.query("select * from public.instagram_accounts"));
    await assert.rejects(db.query("select * from public.instagram_feeds"));
    await assert.rejects(db.query("select * from public.whatsapp_links"));
    await assert.rejects(
      db.query("select * from public.business_transcription_credentials"),
    );
    await assert.rejects(db.query("select * from public.assistant_runs"));
    await assert.rejects(
      db.query("select public.due_assistant_conversations()"),
    );
    await assert.rejects(
      db.query("select public.request_assistant_analysis($1,$2)", [
        biz.id,
        pending.id,
      ]),
    );
    await db.exec("reset role;set role anon;");
    await assert.rejects(
      db.query("select public.request_assistant_analysis($1,$2)", [
        biz.id,
        pending.id,
      ]),
    );
  } finally {
    await db.close();
  }
});
