import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
test("PostgreSQL migration: RLS, atomic RPC, tenant foreign keys and exclusion constraint", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec(
      `create schema extensions;create schema auth;create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema auth to authenticated,service_role;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;set search_path=public,extensions;`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261002035939_studioflow_initial.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"),
    );
    assert.equal(
      (
        await db.query(
          "select * from public.businesses where slug='barber-011'",
        )
      ).rows.length,
      1,
    );
    await db.query("insert into auth.users(id)values($1),($2)", [owner, other]);
    await db.exec("set role service_role;");
    const input = {
      name: "Barbearia teste",
      category: "Barbearia",
      cover: "",
      services: [{ name: "Corte + barba", duration: 60, price: 65 }],
      professionalNames: ["Lucas"],
      openDays: [0, 1, 2, 3, 4, 5, 6],
      openStart: "09:00",
      openEnd: "20:00",
    };
    await db.query("select public.create_workspace($1,$2,$3::jsonb)", [
      owner,
      "test-one",
      JSON.stringify(input),
    ]);
    await db.query("select public.create_workspace($1,$2,$3::jsonb)", [
      other,
      "test-two",
      JSON.stringify(input),
    ]);
    const biz = (
      await db.query<{ id: string; tenant_id: string }>(
        "select id,tenant_id from public.businesses where slug=$1",
        ["test-one"],
      )
    ).rows[0];
    const person = (
      await db.query<{ id: string }>(
        "select id from public.professionals where business_id=$1",
        [biz.id],
      )
    ).rows[0].id;
    const service = (
      await db.query<{ id: string }>(
        "select id from public.services where business_id=$1",
        [biz.id],
      )
    ).rows[0].id;
    const customer = (
      await db.query<{ id: string }>(
        "insert into public.customers(tenant_id,business_id,name,phone)values($1,$2,$3,$4)returning id",
        [biz.tenant_id, biz.id, "Carlos", "11987654321"],
      )
    ).rows[0].id;
    const start = new Date(Date.now() + 3 * 86400000);
    start.setUTCHours(18, 0, 0, 0);
    const booked = await db.query<{ result: { id: string; token: string } }>(
      "select public.book_appointment($1,$2::uuid[],$3,$4,$5,$6)as result",
      [
        biz.id,
        [service],
        person,
        start.toISOString(),
        "Carlos Henrique",
        "11987654321",
      ],
    );
    assert.equal(booked.rows[0].result.token.length, 64);
    await assert.rejects(
      db.query("select public.book_appointment($1,$2::uuid[],$3,$4,$5,$6)", [
        biz.id,
        [service],
        person,
        new Date(start.getTime() - 30 * 60000).toISOString(),
        "Outra pessoa",
        "11987654322",
      ]),
      /unavailable/,
    );
    await assert.rejects(
      db.query(
        'insert into public.appointments(tenant_id,business_id,customer_id,professional_id,customer_name,customer_phone,"start","end",occupied_end,price)values($1,$2,$3,$4,$5,$6,$7,$8,$8,$9)',
        [
          biz.tenant_id,
          biz.id,
          customer,
          person,
          "Carlos",
          "11987654321",
          start.toISOString(),
          new Date(start.getTime() + 60000).toISOString(),
          65,
        ],
      ),
      /no_double_booking/,
    );
    const second = (
      await db.query<{ id: string; tenant_id: string }>(
        "select id,tenant_id from public.businesses where slug=$1",
        ["test-two"],
      )
    ).rows[0];
    await assert.rejects(
      db.query(
        "insert into public.payments(tenant_id,business_id,appointment_id,amount,method)values($1,$2,$3,65,'pix')",
        [second.tenant_id, second.id, booked.rows[0].result.id],
      ),
      /foreign key/,
    );
    const mutate = (entity: string, action: string, data: unknown) =>
      db.query("select public.workspace_mutation($1,$2,$3,$4,$5::jsonb)", [
        biz.id,
        owner,
        entity,
        action,
        JSON.stringify(data),
      ]);
    await assert.rejects(
      mutate("payments", "create", {
        appointmentId: booked.rows[0].result.id,
        amount: 65,
        method: "pix",
      }),
      /complete appointment/,
    );
    await mutate("services", "update", {
      id: service,
      duration: 90,
      price: 100,
      active: false,
    });
    await mutate("appointments", "update", {
      id: booked.rows[0].result.id,
      status: "completed",
    });
    const snapshot = (
      await db.query<{ price: number; end: string }>(
        'select price,"end"from public.appointments where id=$1',
        [booked.rows[0].result.id],
      )
    ).rows[0];
    assert.equal(Number(snapshot.price), 65);
    assert.equal(
      new Date(snapshot.end).getTime(),
      start.getTime() + 60 * 60000,
    );
    await mutate("payments", "create", {
      appointmentId: booked.rows[0].result.id,
      amount: 50,
      method: "pix",
    });
    await assert.rejects(
      mutate("payments", "create", {
        appointmentId: booked.rows[0].result.id,
        amount: 16,
        method: "pix",
      }),
      /remaining balance/,
    );
    const supplied = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await mutate("professionals", "create", {
      id: supplied,
      name: "Ana",
      photo: "",
      phone: "",
      specialties: [],
      commission: 35,
      active: true,
      days: [1, 2, 3, 4, 5, 6],
      start: "09:00",
      end: "18:00",
      breakStart: "",
      breakEnd: "",
    });
    assert.equal(
      (
        await db.query("select id from public.professionals where id=$1", [
          supplied,
        ])
      ).rows.length,
      1,
    );
    await assert.rejects(
      mutate("professionals", "create", { id: supplied, name: "Duplicado" }),
      /identifier already exists/,
    );
    const foreignPerson = (
      await db.query<{ id: string }>(
        "select id from public.professionals where business_id=$1",
        [second.id],
      )
    ).rows[0].id;
    await assert.rejects(
      mutate("professionals", "update", { id: foreignPerson, name: "Ataque" }),
      /forbidden/,
    );
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`,
    );
    assert.equal(
      (await db.query("select * from public.businesses")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.businesses where slug='test-two'"))
        .rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "update public.services set business_id=$1,tenant_id=$2 where id=$3",
        [second.id, second.tenant_id, service],
      ),
      /immutable|row-level security/,
    );
    await assert.rejects(
      db.query("select public.book_appointment($1,$2::uuid[],$3,$4,$5,$6)", [
        biz.id,
        [service],
        person,
        start.toISOString(),
        "Carlos",
        "11987654321",
      ]),
      /permission denied/,
    );
    await db.exec("reset role;set role anon;");
    await assert.rejects(
      db.query("select * from public.customers"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
