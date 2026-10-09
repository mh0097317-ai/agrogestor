import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

test("customer lock: the same phone cannot book two overlapping times, even with another professional", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const migration = (name: string) =>
    readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
  try {
    await db.exec(
      `create schema extensions;create schema auth;create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema auth to authenticated,service_role;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;set search_path=public,extensions;`,
    );
    for (const name of [
      "20261002035939_studioflow_initial.sql",
      "20261004120000_studioflow_reviews.sql",
      "20261004150000_studioflow_loyalty_waitlist.sql",
      "20261005120000_studioflow_payments.sql",
      "20261012120000_studioflow_customer_lock.sql",
    ])
      await db.exec(await migration(name));
    await db.query("insert into auth.users(id)values($1)", [owner]);
    await db.exec("set role service_role;");
    await db.query("select public.create_workspace($1,$2,$3::jsonb)", [
      owner,
      "trava",
      JSON.stringify({
        name: "Casa trava",
        category: "Barbearia",
        cover: "",
        services: [{ name: "Corte", duration: 40, price: 50 }],
        professionalNames: ["Lucas", "Rafael"],
        openDays: [0, 1, 2, 3, 4, 5, 6],
        openStart: "09:00",
        openEnd: "20:00",
      }),
    ]);
    const { id } = (await db.query<{ id: string }>("select id from public.businesses where slug='trava'")).rows[0];
    const service = (await db.query<{ id: string }>("select id from public.services where business_id=$1", [id])).rows[0].id;
    const people = (await db.query<{ id: string }>("select id from public.professionals where business_id=$1 order by name", [id])).rows;
    const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const book = (professional: string, time: string, phone = "11987654321") =>
      db.query("select public.book_appointment($1,$2,$3,$4,$5,$6)", [
        id,
        [service],
        professional,
        `${day}T${time}:00-03:00`,
        "Cliente Teste",
        phone,
      ]);
    await book(people[0].id, "14:00");
    await assert.rejects(book(people[1].id, "14:20"), /customer busy/);
    await book(people[1].id, "14:20", "11987650000");
    await book(people[0].id, "15:00");
  } finally {
    await db.close();
  }
});
