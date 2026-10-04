import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  stranger = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const migration = (name: string) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

test("sinal via Pix e clube: reserva com prazo, confirmação idempotente, limite do plano e RLS", async () => {
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
    ])
      await db.exec(await migration(name));
    await db.query("insert into auth.users(id)values($1),($2)", [
      owner,
      stranger,
    ]);
    await db.exec("set role service_role;");
    const input = {
      name: "Barbearia do sinal",
      category: "Barbearia",
      cover: "",
      services: [
        { name: "Corte", duration: 40, price: 50 },
        { name: "Barba", duration: 30, price: 35 },
      ],
      professionalNames: ["Lucas"],
      openDays: [0, 1, 2, 3, 4, 5, 6],
      openStart: "09:00",
      openEnd: "20:00",
    };
    for (const [user, slug] of [
      [owner, "pix-one"],
      [stranger, "pix-two"],
    ])
      await db.query("select public.create_workspace($1,$2,$3::jsonb)", [
        user,
        slug,
        JSON.stringify(input),
      ]);
    const biz = (
      await db.query<{ id: string; tenant_id: string }>(
        "select id,tenant_id from public.businesses where slug='pix-one'",
      )
    ).rows[0];
    const services = (
      await db.query<{ id: string; name: string }>(
        "select id,name from public.services where business_id=$1 order by name desc",
        [biz.id],
      )
    ).rows;
    const cut = services.find((service) => service.name === "Corte")!.id;
    const beard = services.find((service) => service.name === "Barba")!.id;
    const day = (offset: number, hour = 15) => {
      const date = new Date(Date.now() + offset * 86400000);
      date.setUTCHours(hour, 0, 0, 0);
      return date.toISOString();
    };
    const book = async (start: string, phone = "62991234567", service = cut) =>
      (
        await db.query<{ result: { id: string; token: string } }>(
          "select public.book_appointment($1,$2::uuid[],null,$3,$4,$5)as result",
          [biz.id, [service], start, "Matheus Henrique", phone],
        )
      ).rows[0].result;
    const row = async (id: string) =>
      (
        await db.query<{
          status: string;
          deposit_status: string | null;
          deposit_amount: string | null;
          price: string;
          membership_id: string | null;
        }>(
          "select status,deposit_status,deposit_amount,price,membership_id from public.appointments where id=$1",
          [id],
        )
      ).rows[0];

    // Settings: percent above 100 is refused.
    await assert.rejects(
      db.query(
        "update public.business_settings set deposit_mode='percent',deposit_value=150 where business_id=$1",
        [biz.id],
      ),
      /check/,
    );

    // Hold: the slot stays taken while the Pix is pending.
    const held = await book(day(2));
    await db.query("select public.hold_for_deposit($1,20,15)", [held.id]);
    assert.deepEqual(
      { ...(await row(held.id)), price: undefined },
      {
        status: "pending",
        deposit_status: "pending",
        deposit_amount: "20.00",
        price: undefined,
        membership_id: null,
      },
    );
    await assert.rejects(
      db.query("select public.hold_for_deposit($1,20,15)", [held.id]),
      /invalid deposit/,
    );
    await assert.rejects(book(day(2), "62991234568"), /unavailable/);
    await db.query(
      "update public.appointments set deposit_charge_id='pay_1' where id=$1",
      [held.id],
    );
    // Rescheduling waits for the payment.
    await assert.rejects(
      db.query("select public.manage_booking($1,'reschedule',$2)", [
        held.token,
        day(3),
      ]),
      /deposit pending/,
    );

    // Paid on time: confirmed, and the deposit lands once in the finances.
    assert.equal(
      (
        await db.query<{ r: string }>(
          "select public.confirm_deposit($1,'pay_1')as r",
          [biz.id],
        )
      ).rows[0].r,
      "confirmed",
    );
    assert.equal(
      (
        await db.query<{ r: string }>(
          "select public.confirm_deposit($1,'pay_1')as r",
          [biz.id],
        )
      ).rows[0].r,
      "already",
    );
    assert.equal((await row(held.id)).status, "confirmed");
    const payments = await db.query<{ amount: string; method: string }>(
      "select amount,method from public.payments where appointment_id=$1",
      [held.id],
    );
    assert.deepEqual(payments.rows, [{ amount: "20.00", method: "pix" }]);
    // Another business never confirms this charge.
    const other = (
      await db.query<{ id: string }>(
        "select id from public.businesses where slug='pix-two'",
      )
    ).rows[0].id;
    assert.equal(
      (
        await db.query<{ r: string }>(
          "select public.confirm_deposit($1,'pay_1')as r",
          [other],
        )
      ).rows[0].r,
      "unknown",
    );

    // Expired hold: the next booking frees the slot automatically.
    const late = await book(day(4));
    await db.query("select public.hold_for_deposit($1,20,15)", [late.id]);
    await db.query(
      "update public.appointments set deposit_charge_id='pay_2',deposit_expires_at=now()-interval '1 minute' where id=$1",
      [late.id],
    );
    const taker = await book(day(4), "62991234569");
    assert.deepEqual(
      [(await row(late.id)).status, (await row(late.id)).deposit_status],
      ["cancelled", "expired"],
    );
    // Paid after someone else took the slot: stays cancelled, flagged to refund.
    assert.equal(
      (
        await db.query<{ r: string }>(
          "select public.confirm_deposit($1,'pay_2')as r",
          [biz.id],
        )
      ).rows[0].r,
      "refund",
    );
    assert.equal((await row(late.id)).deposit_status, "paid");
    assert.equal((await row(taker.id)).status, "confirmed");

    // Expired but the slot is still free: the late payment brings it back.
    const revived = await book(day(5));
    await db.query("select public.hold_for_deposit($1,20,15)", [revived.id]);
    await db.query(
      "update public.appointments set deposit_charge_id='pay_3',deposit_expires_at=now()-interval '1 minute' where id=$1",
      [revived.id],
    );
    await db.query("select public.expire_deposit_holds($1)", [biz.id]);
    assert.equal((await row(revived.id)).status, "cancelled");
    assert.equal(
      (
        await db.query<{ r: string }>(
          "select public.confirm_deposit($1,'pay_3')as r",
          [biz.id],
        )
      ).rows[0].r,
      "confirmed",
    );

    // Two services in one visit: duration and price add up, both kept.
    const combo = (
      await db.query<{
        result: { id: string; price: number; start: string; end: string };
      }>(
        "select public.book_appointment($1,$2::uuid[],null,$3,$4,$5)as result",
        [biz.id, [cut, beard], day(8, 13), "Matheus Henrique", "62991234560"],
      )
    ).rows[0].result;
    assert.equal(Number(combo.price), 85);
    assert.equal((Date.parse(combo.end) - Date.parse(combo.start)) / 60000, 70);
    assert.equal(
      (
        await db.query(
          "select 1 from public.appointment_services where appointment_id=$1",
          [combo.id],
        )
      ).rows.length,
      2,
    );

    // Club: plan with the cut only, twice a month.
    const plan = (
      await db.query<{ id: string }>(
        "insert into public.membership_plans(tenant_id,business_id,name,price,service_ids,monthly_limit)values($1,$2,'Clube Corte',89.9,$3::uuid[],2)returning id",
        [biz.tenant_id, biz.id, [cut]],
      )
    ).rows[0].id;
    const customer = (
      await db.query<{ id: string }>(
        "select id from public.customers where business_id=$1 and phone='62991234567'",
        [biz.id],
      )
    ).rows[0].id;
    const token = randomBytes(32).toString("hex");
    const member = (
      await db.query<{ id: string }>(
        "insert into public.memberships(tenant_id,business_id,plan_id,customer_id,customer_name,customer_phone,price,token_hash)values($1,$2,$3,$4,'Matheus Henrique','62991234567',89.9,$5)returning id",
        [
          biz.tenant_id,
          biz.id,
          plan,
          customer,
          createHash("sha256").update(token).digest(),
        ],
      )
    ).rows[0].id;
    const apply = async (id: string, value = token) =>
      (
        await db.query<{ r: string }>(
          "select public.apply_membership($1,$2)as r",
          [id, value],
        )
      ).rows[0].r;
    // Pending subscription covers nothing yet.
    const firstClub = await book(day(10, 13));
    assert.equal(await apply(firstClub.id), "inactive");
    await db.query(
      "update public.memberships set status='active' where id=$1",
      [member],
    );
    assert.equal(await apply(firstClub.id, "f".repeat(64)), "invalid");
    assert.equal(await apply(firstClub.id), "covered");
    assert.equal(await apply(firstClub.id), "covered");
    assert.equal((await row(firstClub.id)).price, "0.00");
    assert.equal(
      (
        await db.query<{ price: string }>(
          "select price from public.appointment_services where appointment_id=$1",
          [firstClub.id],
        )
      ).rows[0].price,
      "0.00",
    );
    // Another phone or a service outside the plan pays normally.
    assert.equal(
      await apply((await book(day(10, 14), "62991234500")).id),
      "phone",
    );
    assert.equal(
      await apply((await book(day(10, 15), "62991234567", beard)).id),
      "services",
    );
    // A covered booking never also asks for a deposit.
    await assert.rejects(
      db.query("select public.hold_for_deposit($1,20,15)", [firstClub.id]),
      /invalid deposit/,
    );
    // Limit of two in the same month.
    const second = await book(day(10, 16));
    assert.equal(await apply(second.id), "covered");
    assert.equal(await apply((await book(day(10, 17))).id), "limit");
    // Cancelling one frees a use.
    await db.query("select public.manage_booking($1,'cancel')", [second.token]);
    assert.equal(await apply((await book(day(10, 18))).id), "covered");
    const receipt = (
      await db.query<{ result: { membership_plan: string } }>(
        "select public.get_booking($1)as result",
        [firstClub.token],
      )
    ).rows[0].result;
    assert.equal(receipt.membership_plan, "Clube Corte");

    // RLS: the API key never reaches members; plans only for the business.
    await db.query(
      "insert into public.payment_accounts(business_id,tenant_id,environment,api_key_enc)values($1,$2,'sandbox','cipher')",
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
    await assert.rejects(
      db.query("select * from public.payment_accounts"),
      /permission denied/,
    );
    assert.equal(
      (await db.query("select * from public.membership_plans")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.memberships")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("update public.memberships set status='active'"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.confirm_deposit($1,'pay_1')", [biz.id]),
      /permission denied/,
    );
    await as(stranger);
    assert.equal(
      (await db.query("select * from public.memberships")).rows.length,
      0,
    );
    await db.exec("reset role;");
    await db.exec("set role anon;");
    await assert.rejects(
      db.query("select * from public.membership_plans"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
