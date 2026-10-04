import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  stranger = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const migration = (name: string) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

test("recepcionista: limite diário, conversa sem duplicar mensagem e RLS", async () => {
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
    ])
      await db.exec(await migration(name));
    await db.query("insert into auth.users(id)values($1),($2)", [
      owner,
      stranger,
    ]);
    await db.exec("set role service_role;");
    const input = {
      name: "Barbearia IA",
      category: "Barbearia",
      cover: "",
      services: [{ name: "Corte", duration: 40, price: 50 }],
      professionalNames: ["Lucas"],
      openDays: [0, 1, 2, 3, 4, 5, 6],
      openStart: "09:00",
      openEnd: "20:00",
    };
    for (const [user, slug] of [
      [owner, "ia-one"],
      [stranger, "ia-two"],
    ])
      await db.query("select public.create_workspace($1,$2,$3::jsonb)", [
        user,
        slug,
        JSON.stringify(input),
      ]);
    const biz = (
      await db.query<{ id: string; tenant_id: string }>(
        "select id,tenant_id from public.businesses where slug='ia-one'",
      )
    ).rows[0];

    // Daily cap: the 11th turn of a 10-turn day is refused and not counted.
    await db.query(
      "update public.business_settings set assistant_daily_limit=10 where business_id=$1",
      [biz.id],
    );
    const turns: boolean[] = [];
    for (let index = 0; index < 11; index++)
      turns.push(
        (
          await db.query<{ ok: boolean }>(
            "select public.assistant_take_turn($1) as ok",
            [biz.id],
          )
        ).rows[0].ok,
      );
    assert.deepEqual(turns.filter(Boolean).length, 10);
    assert.equal(turns[10], false);
    await db.query("select public.assistant_add_tokens($1,1200,300)", [
      biz.id,
    ]);
    const usage = (
      await db.query<{ turns: number; input_tokens: string }>(
        "select turns,input_tokens from public.assistant_usage where business_id=$1",
        [biz.id],
      )
    ).rows[0];
    assert.deepEqual([usage.turns, Number(usage.input_tokens)], [10, 1200]);
    await assert.rejects(
      db.query(
        "update public.business_settings set assistant_instructions=repeat('x',1501) where business_id=$1",
        [biz.id],
      ),
      /check/,
    );

    // One WhatsApp conversation per contact; a redelivered message is refused.
    const conversation = (
      await db.query<{ id: string }>(
        "insert into public.conversations(tenant_id,business_id,channel,contact_phone)values($1,$2,'whatsapp','11987654321')returning id",
        [biz.tenant_id, biz.id],
      )
    ).rows[0].id;
    await assert.rejects(
      db.query(
        "insert into public.conversations(tenant_id,business_id,channel,contact_phone)values($1,$2,'whatsapp','11987654321')",
        [biz.tenant_id, biz.id],
      ),
      /duplicate key/,
    );
    const lease = async () =>
      (
        await db.query<{ ok: boolean }>(
          "select public.conversation_lease($1) as ok",
          [conversation],
        )
      ).rows[0].ok;
    assert.equal(await lease(), true);
    assert.equal(await lease(), false);
    await db.query(
      "update public.conversations set processing_until=now()-interval '1 second' where id=$1",
      [conversation],
    );
    assert.equal(await lease(), true);
    const message =
      "insert into public.conversation_messages(tenant_id,business_id,conversation_id,role,body,provider_message_id)values($1,$2,$3,'customer','Oi','wamid.1')";
    await db.query(message, [biz.tenant_id, biz.id, conversation]);
    await assert.rejects(
      db.query(message, [biz.tenant_id, biz.id, conversation]),
      /duplicate key/,
    );
    await db.query(
      "insert into public.whatsapp_accounts(business_id,tenant_id,phone_number_id,access_token_enc,app_secret_enc,verify_token_hash)values($1,$2,'123456789','x','y','\\x00')",
      [biz.id, biz.tenant_id],
    );

    const as = async (user: string) => {
      await db.exec("reset role;");
      await db.exec("set role authenticated;");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user,
      ]);
    };
    await as(owner);
    assert.equal(
      (await db.query("select * from public.conversation_messages")).rows
        .length,
      1,
    );
    await assert.rejects(
      db.query("select * from public.whatsapp_accounts"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("update public.conversations set status='human'"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.assistant_take_turn($1)", [biz.id]),
      /permission denied/,
    );
    await as(stranger);
    assert.equal(
      (await db.query("select * from public.conversations")).rows.length,
      0,
    );
    await db.exec("reset role;");
    await db.exec("set role anon;");
    await assert.rejects(
      db.query("select * from public.conversations"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
