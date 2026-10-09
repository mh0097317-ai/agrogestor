import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

test("admin channels: atomic audit, tenant scope, real booking attribution and financial aggregates", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec(
      `create schema extensions;create schema auth;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema auth to authenticated,service_role;create table auth.users(id uuid primary key,email text,last_sign_in_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;set search_path=public,extensions;`,
    );
    const directory = new URL("../supabase/migrations/", import.meta.url);
    const files = (await readdir(directory))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const last = files.pop()!;
    for (const file of files)
      await db.exec(await readFile(new URL(file, directory), "utf8"));
    const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await db.query("insert into auth.users(id) values($1),($2)", [
      owner,
      other,
    ]);
    await db.exec("set role service_role");
    const input = JSON.stringify({
      name: "Loja",
      category: "Barbearia",
      cover: "",
      services: [{ name: "Corte", duration: 40, price: 50 }],
      professionalNames: ["Lucas"],
      openDays: [0, 1, 2, 3, 4, 5, 6],
      openStart: "09:00",
      openEnd: "20:00",
    });
    for (const [user, slug] of [
      [owner, "one"],
      [other, "two"],
    ])
      await db.query("select public.create_workspace($1,$2,$3::jsonb)", [
        user,
        slug,
        input,
      ]);
    await db.exec(
      "update public.platform_access set status='active';update public.business_settings set assistant_enabled=true",
    );
    const biz = (
      await db.query<{ id: string; tenant_id: string }>(
        "select id,tenant_id from public.businesses order by slug",
      )
    ).rows;
    const service = (
      await db.query<{ id: string }>(
        "select id from public.services where business_id=$1",
        [biz[0].id],
      )
    ).rows[0].id;
    const person = (
      await db.query<{ id: string }>(
        "select id from public.professionals where business_id=$1",
        [biz[0].id],
      )
    ).rows[0].id;
    const start = new Date(Date.now() + 3 * 86400000);
    start.setUTCHours(16, 0, 0, 0);
    const args = [
      biz[0].id,
      [service],
      person,
      start.toISOString(),
      "Cliente",
      "11987654321",
    ];
    const legacy = (
      await db.query<{ result: { id: string } }>(
        "select public.book_appointment($1,$2::uuid[],$3,$4,$5,$6) result",
        args,
      )
    ).rows[0].result;
    await db.exec("reset role");
    await db.exec(await readFile(new URL(last, directory), "utf8"));
    await db.exec("set role service_role");
    assert.equal(
      (
        await db.query<{ booking_channel: string }>(
          "select booking_channel from public.appointments where id=$1",
          [legacy.id],
        )
      ).rows[0].booking_channel,
      "legacy",
    );
    await assert.rejects(
      db.query(
        "select public.platform_set_channel($1,$2,'public_link',false)",
        [biz[0].id, other],
      ),
      /forbidden/,
    );
    await db.query("insert into public.platform_admins(user_id) values($1)", [
      owner,
    ]);
    await db.query(
      "select public.platform_set_channel($1,$2,'public_link',false)",
      [biz[0].id, owner],
    );
    assert.equal(
      (
        await db.query<{ enabled: boolean }>(
          "select online_booking_enabled enabled from public.business_settings where business_id=$1",
          [biz[1].id],
        )
      ).rows[0].enabled,
      true,
    );
    assert.equal(
      (await db.query("select * from public.platform_channel_events")).rows
        .length,
      1,
    );
    const convo = (
      await db.query<{ id: string }>(
        "insert into public.conversations(tenant_id,business_id,channel)values($1,$2,'whatsapp') returning id",
        [biz[0].tenant_id, biz[0].id],
      )
    ).rows[0].id;
    const foreignConvo = (
      await db.query<{ id: string }>(
        "insert into public.conversations(tenant_id,business_id,channel)values($1,$2,'whatsapp') returning id",
        [biz[1].tenant_id, biz[1].id],
      )
    ).rows[0].id;
    args[3] = new Date(start.getTime() + 3600000).toISOString();
    const tracked =
      "select public.book_tracked_appointment($1,$2::uuid[],$3,$4,$5,$6,null,false,$7,$8) result";
    await assert.rejects(
      db.query(tracked, [...args, "public_link", null]),
      /online booking disabled/,
    );
    await assert.rejects(
      db.query(tracked, [...args, "assistant_whatsapp", foreignConvo]),
      /invalid conversation scope/,
    );
    const booked = (
      await db.query<{
        result: {
          id: string;
          booking_channel: string;
          conversation_id: string;
        };
      }>(tracked, [...args, "assistant_whatsapp", convo])
    ).rows[0].result;
    assert.equal(booked.booking_channel, "assistant_whatsapp");
    assert.equal(booked.conversation_id, convo);
    await db.query(
      "insert into public.conversation_messages(tenant_id,business_id,conversation_id,role,body)values($1,$2,$3,'customer','Oi'),($1,$2,$3,'customer','Confirmo')",
      [biz[0].tenant_id, biz[0].id, convo],
    );
    await db.query(
      "insert into public.payments(tenant_id,business_id,appointment_id,amount,method)values($1,$2,$3,15,'pix'),($1,$2,$3,10,'cash')",
      [biz[0].tenant_id, biz[0].id, booked.id],
    );
    const stats = (
      await db.query<{
        result: {
          businessId: string;
          appointments: number;
          received: number;
          assistantReceived: number;
          conversations: number;
          assistantBookings: number;
        };
      }>(
        "select public.platform_activity(current_date-1,current_date+1) result",
      )
    ).rows.map((r) => r.result);
    const one = stats.find((r) => r.businessId === biz[0].id)!;
    const two = stats.find((r) => r.businessId === biz[1].id)!;
    assert.equal(one.appointments, 2);
    assert.equal(one.received, 25);
    assert.equal(one.assistantReceived, 25);
    assert.equal(one.assistantBookings, 1);
    assert.equal(one.conversations, 1);
    assert.equal(two.received, 0);
    assert.equal(two.appointments, 0);
    await db.query(
      "select public.platform_set_channel($1,$2,'receptionist',false)",
      [biz[0].id, owner],
    );
    args[3] = new Date(start.getTime() + 7200000).toISOString();
    await assert.rejects(
      db.query(tracked, [...args, "assistant_whatsapp", convo]),
      /assistant disabled/,
    );
    await db.query(
      "select public.book_appointment($1,$2::uuid[],$3,$4,$5,$6)",
      args,
    );
    const manualId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await db.query("select public.workspace_mutation($1,$2,'appointments','create',$3::jsonb)",[
      biz[0].id,owner,JSON.stringify({id:manualId,serviceIds:[service],professionalId:person,start:new Date(start.getTime()+10800000).toISOString(),customerName:"Manual",customerPhone:"11987654322",bookingChannel:"assistant_whatsapp",conversationId:foreignConvo}),
    ]);
    const manual=(await db.query<{booking_channel:string;conversation_id:string|null}>("select booking_channel,conversation_id from public.appointments where id=$1",[manualId])).rows[0];
    assert.equal(manual.booking_channel,"manual");assert.equal(manual.conversation_id,null);
    await db.query("select public.workspace_mutation($1,$2,'appointments','update',$3::jsonb)",[
      biz[0].id,owner,JSON.stringify({id:booked.id,serviceIds:[service],professionalId:person,start:new Date(start.getTime()+3600000).toISOString(),customerName:"Cliente atualizado",customerPhone:"11987654321",bookingChannel:"manual",conversationId:foreignConvo}),
    ]);
    const preserved=(await db.query<{booking_channel:string;conversation_id:string}>("select booking_channel,conversation_id from public.appointments where id=$1",[booked.id])).rows[0];
    assert.equal(preserved.booking_channel,"assistant_whatsapp");assert.equal(preserved.conversation_id,convo);
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select public.platform_activity(current_date,current_date)"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.platform_set_channel($1,$2,'public_link',true)", [
        biz[0].id,
        owner,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query(tracked, [...args, "public_link", null]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
