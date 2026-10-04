import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const veteran = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  newcomer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  staff = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const migration = (name: string) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const input = {
  name: "Barbearia",
  category: "Barbearia",
  cover: "",
  services: [{ name: "Corte", duration: 40, price: 50 }],
  professionalNames: ["Lucas"],
  openDays: [1, 2, 3, 4, 5, 6],
  openStart: "09:00",
  openEnd: "19:00",
};

test("plataforma: cadastro novo aguarda liberação, prazos somam e só o servidor mexe", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec(
      `create schema extensions;create schema auth;create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema auth to authenticated,service_role;create table auth.users(id uuid primary key,email text,last_sign_in_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;set search_path=public,extensions;`,
    );
    for (const name of [
      "20261002035939_studioflow_initial.sql",
      "20261004120000_studioflow_reviews.sql",
      "20261004150000_studioflow_loyalty_waitlist.sql",
      "20261005120000_studioflow_payments.sql",
      "20261006120000_studioflow_assistant.sql",
    ])
      await db.exec(await migration(name));
    await db.query(
      "insert into auth.users(id,email)values($1,'dono@antigo.test'),($2,'dono@novo.test'),($3,'equipe@studioflow.test')",
      [veteran, newcomer, staff],
    );
    await db.exec("set role service_role;");
    // A business that existed before the platform keeps working.
    await db.query("select public.create_workspace($1,'antiga',$2::jsonb)", [
      veteran,
      JSON.stringify(input),
    ]);
    await db.exec("reset role;");
    await db.exec(await migration("20261007120000_studioflow_platform.sql"));
    await db.exec("set role service_role;");
    await db.query("select public.create_workspace($1,'nova',$2::jsonb)", [
      newcomer,
      JSON.stringify(input),
    ]);
    const access = async (slug: string) =>
      (
        await db.query<{ status: string; access_until: string | null; id: string }>(
          "select a.status,a.access_until,b.id from public.platform_access a join public.businesses b on b.id=a.business_id where b.slug=$1",
          [slug],
        )
      ).rows[0];
    const old = await access("antiga"),
      fresh = await access("nova");
    assert.equal(old.status, "active");
    assert.equal(old.access_until, null);
    assert.equal(fresh.status, "pending");
    const created = await db.query(
      "select 1 from public.platform_access_events where business_id=$1 and action='created'",
      [fresh.id],
    );
    assert.equal(created.rows.length, 1);

    // 30 days, then 7 more: the second grant adds to what is left.
    await db.query(
      "select public.platform_set_access($1,$2,'granted',30)",
      [fresh.id, staff],
    );
    let row = await access("nova");
    assert.equal(row.status, "active");
    const firstUntil = new Date(row.access_until!).getTime();
    assert.ok(Math.abs(firstUntil - (Date.now() + 30 * 86_400_000)) < 120_000);
    await db.query("select public.platform_set_access($1,$2,'granted',7)", [
      fresh.id,
      staff,
    ]);
    row = await access("nova");
    assert.ok(
      Math.abs(new Date(row.access_until!).getTime() - (firstUntil + 7 * 86_400_000)) <
        5_000,
    );

    // Suspending keeps the date; reactivating without a limit clears it.
    await db.query("select public.platform_set_access($1,$2,'suspended')", [
      fresh.id,
      staff,
    ]);
    row = await access("nova");
    assert.equal(row.status, "suspended");
    assert.ok(row.access_until);
    await db.query("select public.platform_set_access($1,$2,'unlimited')", [
      fresh.id,
      staff,
    ]);
    row = await access("nova");
    assert.equal(row.status, "active");
    assert.equal(row.access_until, null);

    for (const [sql, params] of [
      ["select public.platform_set_access($1,$2,'granted',0)", [fresh.id, staff]],
      ["select public.platform_set_access($1,$2,'until',null,now()-interval '1 day')", [fresh.id, staff]],
      ["select public.platform_set_access($1,$2,'whatever')", [fresh.id, staff]],
    ] as const)
      await assert.rejects(db.query(sql, [...params]));
    const events = await db.query<{ action: string }>(
      "select action from public.platform_access_events where business_id=$1 order by created_at",
      [fresh.id],
    );
    assert.deepEqual(
      events.rows.map((event) => event.action),
      ["created", "granted", "granted", "suspended", "unlimited"],
    );

    const overview = await db.query<{ value: Record<string, unknown> }>(
      "select value from public.platform_overview() as value",
    );
    const listed = overview.rows.map((item) => item.value);
    assert.equal(listed.length, 2);
    assert.equal(
      listed.find((item) => item.slug === "nova")?.owner_email,
      "dono@novo.test",
    );

    // Owners and visitors never see or change platform data.
    await db.exec("reset role;set role authenticated;");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      newcomer,
    ]);
    for (const sql of [
      "select * from public.platform_access",
      "select * from public.platform_admins",
      "select public.platform_set_access('00000000-0000-4000-8000-000000000000'::uuid,null,'unlimited')",
      "select * from public.platform_overview()",
    ])
      await assert.rejects(db.query(sql));
    await db.exec("reset role;set role anon;");
    await assert.rejects(db.query("select * from public.platform_access"));
  } finally {
    await db.close();
  }
});
