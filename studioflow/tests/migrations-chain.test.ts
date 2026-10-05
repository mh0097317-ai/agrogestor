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
    const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
    assert.ok(files.length >= 10);
    for (const name of files) await db.exec(await readFile(new URL(name, directory), "utf8"));

    await db.query("insert into auth.users(id,email)values($1,'dono@casa.test')", [owner]);
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
      (await db.query<{ status: string }>("select status from public.platform_access where business_id=$1", [biz.id])).rows[0].status,
      "pending",
    );
    // Plan and modules picked for the client.
    const planned = (
      await db.query<{ value: { modules: string[]; plan: string; monthly_price: string } }>(
        "select public.platform_set_plan($1,null,'Profissional',149.9,array['produtos','clube','produtos']) as value",
        [biz.id],
      )
    ).rows[0].value;
    assert.deepEqual(planned.modules, ["clube", "produtos"]);
    assert.equal(Number(planned.monthly_price), 149.9);
    await assert.rejects(
      db.query("select public.platform_set_plan($1,null,'X',null,array['teletransporte'])", [biz.id]),
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
    await db.query("update public.services set photos=array['/a.jpg','/b.jpg'] where business_id=$1", [biz.id]);
    await assert.rejects(
      db.query("update public.services set photos=array['/a.jpg','/b.jpg','/c.jpg'] where business_id=$1", [biz.id]),
    );
    await db.query("update public.businesses set maps_url='https://maps.app.goo.gl/x' where id=$1", [biz.id]);
    await db.query(
      "insert into public.instagram_feeds(business_id,tenant_id,ig_user_id,username,access_token_enc)values($1,$2,'1789000000','casa','x')",
      [biz.id, biz.tenant_id],
    );
    await db.exec("reset role;set role authenticated;");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    await assert.rejects(db.query("select * from public.instagram_accounts"));
    await assert.rejects(db.query("select * from public.instagram_feeds"));
  } finally {
    await db.close();
  }
});
