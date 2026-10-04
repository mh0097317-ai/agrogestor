import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { ratingLabel, ratingSummary } from "../src/lib/reviews";
import type { Review } from "../src/types";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  stranger = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const migration = (name: string) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

test("reviews: only a completed appointment, once, through its token; members read, others do not", async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec(
      `create schema extensions;create schema auth;create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema auth to authenticated,service_role;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;set search_path=public,extensions;`,
    );
    await db.exec(await migration("20261002035939_studioflow_initial.sql"));
    await db.exec(await migration("20261004120000_studioflow_reviews.sql"));
    await db.query("insert into auth.users(id)values($1),($2)", [
      owner,
      stranger,
    ]);
    await db.exec("set role service_role;");
    await db.query("select public.create_workspace($1,$2,$3::jsonb)", [
      owner,
      "review-test",
      JSON.stringify({
        name: "Barbearia avaliada",
        category: "Barbearia",
        cover: "",
        services: [{ name: "Corte", duration: 40, price: 45 }],
        professionalNames: ["Lucas"],
        openDays: [0, 1, 2, 3, 4, 5, 6],
        openStart: "09:00",
        openEnd: "20:00",
      }),
    ]);
    const biz = (
      await db.query<{ id: string }>(
        "select id from public.businesses where slug='review-test'",
      )
    ).rows[0].id;
    const service = (
      await db.query<{ id: string }>(
        "select id from public.services where business_id=$1",
        [biz],
      )
    ).rows[0].id;
    const start = new Date(Date.now() + 2 * 86400000);
    start.setUTCHours(15, 0, 0, 0);
    const booked = (
      await db.query<{ result: { id: string; token: string } }>(
        "select public.book_appointment($1,$2::uuid[],null,$3,$4,$5)as result",
        [
          biz,
          [service],
          start.toISOString(),
          "Matheus Henrique",
          "62991234567",
        ],
      )
    ).rows[0].result;
    const review = (rating: number, comment = "") =>
      db.query("select public.submit_review($1,$2,$3)as result", [
        booked.token,
        rating,
        comment,
      ]);

    await assert.rejects(review(5), /review_not_allowed/);
    await db.query(
      "update public.appointments set status='completed' where id=$1",
      [booked.id],
    );
    await assert.rejects(review(6), /invalid_rating/);
    await assert.rejects(
      db.query("select public.submit_review($1,5,'')", ["f".repeat(64)]),
      /booking_not_found/,
    );
    const saved = (await review(4, "  Ótimo corte  ")).rows[0] as {
      result: { rating: number; comment: string };
    };
    assert.deepEqual(
      { rating: saved.result.rating, comment: saved.result.comment },
      { rating: 4, comment: "Ótimo corte" },
    );
    await assert.rejects(review(5), /already_reviewed/);

    const stored = (
      await db.query<{ customer_name: string }>(
        "select customer_name from public.reviews where business_id=$1",
        [biz],
      )
    ).rows;
    assert.deepEqual(stored, [{ customer_name: "Matheus" }]);
    const projection = (
      await db.query<{ result: { review: { rating: number } } }>(
        "select public.get_booking($1)as result",
        [booked.token],
      )
    ).rows[0].result;
    assert.equal(projection.review.rating, 4);

    await db.exec("reset role;");
    await db.exec("set role authenticated;");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    assert.equal(
      (await db.query("select * from public.reviews")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("select public.submit_review($1,5,'')", [booked.token]),
      /permission denied/,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      stranger,
    ]);
    assert.equal(
      (await db.query("select * from public.reviews")).rows.length,
      0,
    );
    await db.exec("reset role;");
    await db.exec("set role anon;");
    await assert.rejects(
      db.query("select * from public.reviews"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test("rating summary uses only real reviews", () => {
  const base = {
    businessId: "b",
    appointmentId: "a",
    customerName: "Ana",
    comment: "",
    createdAt: "2026-10-03T12:00:00.000Z",
  };
  const reviews: Review[] = [
    { ...base, id: "1", professionalId: "p1", rating: 5 },
    { ...base, id: "2", professionalId: "p1", rating: 4 },
    { ...base, id: "3", professionalId: "p2", rating: 5 },
  ];
  assert.equal(ratingSummary([]), undefined);
  assert.deepEqual(ratingSummary(reviews), { average: 4.7, count: 3 });
  assert.deepEqual(ratingSummary(reviews, "p1"), { average: 4.5, count: 2 });
  assert.equal(ratingSummary(reviews, "p3"), undefined);
  assert.equal(ratingLabel({ average: 5, count: 1 }), "5,0");
});
