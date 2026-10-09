import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

test("online booking migration: existing/new defaults, transactional guard, RLS, internal channels and preserved tokens", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const receptionist = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const professional = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const migration = (name: string) =>
    readFile(
      new URL(`../supabase/migrations/${name}`, import.meta.url),
      "utf8",
    );
  try {
    await db.exec(
      `create schema extensions;create schema auth;create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema auth to authenticated,service_role;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;set search_path=public,extensions;`,
    );
    for (const name of [
      "20261002035939_studioflow_initial.sql",
      "20261004120000_studioflow_reviews.sql",
      "20261004150000_studioflow_loyalty_waitlist.sql",
      "20261005120000_studioflow_payments.sql",
    ])
      await db.exec(await migration(name));
    await db.query("insert into auth.users(id)values($1),($2),($3),($4)", [
      owner,
      other,
      receptionist,
      professional,
    ]);
    await db.exec("set role service_role;");
    const input = {
      name: "Casa teste",
      category: "Barbearia",
      cover: "",
      services: [{ name: "Corte", duration: 40, price: 50 }],
      professionalNames: ["Lucas"],
      openDays: [0, 1, 2, 3, 4, 5, 6],
      openStart: "09:00",
      openEnd: "20:00",
    };
    const create = (user: string, slug: string) =>
      db.query("select public.create_workspace($1,$2,$3::jsonb)", [
        user,
        slug,
        JSON.stringify(input),
      ]);
    await create(owner, "online-one");
    const business = async (slug: string) =>
      (
        await db.query<{ id: string; tenant_id: string }>(
          "select id,tenant_id from public.businesses where slug=$1",
          [slug],
        )
      ).rows[0];
    const first = await business("online-one");
    const service = (
      await db.query<{ id: string }>(
        "select id from public.services where business_id=$1",
        [first.id],
      )
    ).rows[0].id;
    const person = (
      await db.query<{ id: string }>(
        "select id from public.professionals where business_id=$1",
        [first.id],
      )
    ).rows[0].id;
    const day = (offset: number) => {
      const d = new Date(Date.now() + offset * 86400000);
      d.setUTCHours(15, 0, 0, 0);
      return d.toISOString();
    };
    const book = async (
      rpc: "book_appointment" | "book_public_appointment",
      offset: number,
    ) =>
      (
        await db.query<{ result: { id: string; token: string } }>(
          `select public.${rpc}($1,$2::uuid[],$3,$4,'Cliente teste','11999998888')as result`,
          [first.id, [service], person, day(offset)],
        )
      ).rows[0].result;
    const old = await book("book_appointment", 2);
    await db.exec("reset role;");
    await db.exec(
      await migration("20261011120000_studioflow_online_booking.sql"),
    );
    await db.exec(
      await migration("20261011121000_studioflow_manual_booking_variable.sql"),
    );
    await db.exec("set role service_role;");
    await create(other, "online-two");
    const second = await business("online-two");
    const enabled = async (businessId: string) =>
      (
        await db.query<{ value: boolean }>(
          "select online_booking_enabled as value from public.business_settings where business_id=$1",
          [businessId],
        )
      ).rows[0].value;
    assert.equal(await enabled(first.id), true);
    assert.equal(await enabled(second.id), true);
    await db.query(
      "insert into public.business_members(tenant_id,business_id,user_id,role)values($1,$2,$3,'receptionist'),($1,$2,$4,'professional')",
      [first.tenant_id, first.id, receptionist, professional],
    );
    await db.exec("reset role;set role authenticated;");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    const foreign = await db.query(
      "update public.business_settings set online_booking_enabled=false where business_id=$1 returning business_id",
      [second.id],
    );
    assert.equal(foreign.rows.length, 0);
    await db.query(
      "update public.business_settings set online_booking_enabled=false where business_id=$1",
      [first.id],
    );
    for (const user of [receptionist, professional]) {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user,
      ]);
      assert.equal(
        (
          await db.query(
            "update public.business_settings set online_booking_enabled=true where business_id=$1 returning business_id",
            [first.id],
          )
        ).rows.length,
        0,
      );
    }
    await assert.rejects(
      book("book_public_appointment", 3),
      /permission denied/,
    );
    await db.exec("reset role;set role anon;");
    await assert.rejects(
      book("book_public_appointment", 3),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from public.business_settings"),
      /permission denied/,
    );
    await db.exec("reset role;set role service_role;");
    assert.equal(await enabled(first.id), false);
    assert.equal(await enabled(second.id), true);
    await assert.rejects(
      book("book_public_appointment", 3),
      /online booking disabled/,
    );
    assert.equal(
      (
        await db.query(
          "select id from public.appointments where business_id=$1",
          [first.id],
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query("select id from public.customers where business_id=$1", [
          first.id,
        ])
      ).rows.length,
      1,
    );
    // Same transaction engine remains available to trusted receptionist adapters.
    await book("book_appointment", 3);
    // The actual internal workspace RPC is not blocked by the public setting.
    await db.query(
      "select public.workspace_mutation($1,$2,'appointments','create',$3::jsonb)",
      [
        first.id,
        owner,
        JSON.stringify({
          customerName: "Balcão teste",
          customerPhone: "11999997777",
          serviceIds: [service],
          professionalId: person,
          start: day(4),
          status: "confirmed",
          reminder: false,
        }),
      ],
    );
    const receipt = (
      await db.query<{ result: { appointment: { id: string } } }>(
        "select public.get_booking($1)as result",
        [old.token],
      )
    ).rows[0].result;
    assert.equal(receipt.appointment.id, old.id);
    await db.query("select public.manage_booking($1,'cancel')", [old.token]);
    await db.query(
      "update public.business_settings set online_booking_enabled=true where business_id=$1",
      [first.id],
    );
    const reopened = await book("book_public_appointment", 5);
    assert.equal(reopened.token.length, 64);
    assert.equal((await business("online-one")).id, first.id);
    assert.equal(
      (
        await db.query(
          "select id from public.appointments where business_id=$1",
          [first.id],
        )
      ).rows.length,
      4,
    );
    // Enabled behavior keeps the original overlap protection.
    await assert.rejects(book("book_public_appointment", 5), /unavailable/);
    await assert.rejects(
      db.query(
        "update public.business_settings set online_booking_enabled=null where business_id=$1",
        [first.id],
      ),
      /not-null|null value/,
    );
  } finally {
    await db.close();
  }
});
