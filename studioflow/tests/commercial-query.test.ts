import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { queryCommercialImpact } from "../src/services/commercial-report";

function mockClient(failSecondPage = false) {
  const calls: {
    table: string;
    business: string;
    range?: number[];
    ids?: string[];
  }[] = [];
  const bookings = Array.from({ length: 1001 }, (_, i) => ({
    id: `b${i}`,
    business_id: "own",
    booking_channel: "assistant_whatsapp",
    created_at: "2026-10-08T12:00:00Z",
    start: "2026-10-08T15:00:00Z",
    status: "completed",
  }));
  const payments = Array.from({ length: 1002 }, (_, i) => ({
    id: `p${i}`,
    business_id: "own",
    appointment_id: i === 1001 ? "old" : `b${i}`,
    amount: 1.01,
    created_at: "2026-10-08T19:00:00Z",
  }));
  const old = {
    ...bookings[0],
    id: "old",
    created_at: "2026-09-01T15:00:00Z",
    start: "2026-09-02T15:00:00Z",
  };
  const client = {
    from(table: string) {
      const call: (typeof calls)[number] = { table, business: "" };
      const builder = {
        select() {
          return this;
        },
        eq(column: string, value: string) {
          assert.equal(column, "business_id");
          call.business = value;
          return this;
        },
        or(value: string) {
          assert.match(value, /created_at\.gte\.2026-10-08T00:00:00-03:00/);
          assert.match(value, /start\.lt\.2026-10-09T03:00:00\.000Z/);
          return this;
        },
        gte(column: string, value: string) {
          assert.equal(column, "created_at");
          assert.equal(value, "2026-10-08T00:00:00-03:00");
          return this;
        },
        lt(column: string, value: string) {
          assert.equal(column, "created_at");
          assert.equal(value, "2026-10-09T03:00:00.000Z");
          return this;
        },
        order(column: string) {
          assert.equal(column, "id");
          return this;
        },
        range(lo: number, hi: number) {
          call.range = [lo, hi];
          return this;
        },
        in(column: string, ids: string[]) {
          assert.equal(column, "id");
          call.ids = ids;
          return this;
        },
        then(resolve: (result: unknown) => unknown) {
          calls.push(call);
          assert.equal(
            call.business,
            "own",
            "every page and receipt lookup must be scoped",
          );
          if (failSecondPage && call.range?.[0] === 1000)
            return Promise.resolve(
              resolve({ data: null, error: new Error("unavailable") }),
            );
          const rows = call.ids
            ? [old]
            : table === "appointments"
              ? bookings
              : payments;
          return Promise.resolve(
            resolve({
              data: call.range
                ? rows.slice(call.range[0], call.range[1] + 1)
                : rows,
              error: null,
            }),
          );
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

test("commercial query reads beyond PostgREST's first page and resolves older paid bookings without losing cents", async () => {
  const { client, calls } = mockClient();
  const result = await queryCommercialImpact(
    client,
    "own",
    "2026-10-08",
    "2026-10-08",
  );
  assert.equal(result.assistant.created, 1001);
  assert.equal(result.assistant.completed, 1001);
  assert.equal(result.assistant.receivedCents, 101202);
  assert.equal(calls.filter((c) => c.range?.[0] === 1000).length, 2);
  assert.deepEqual(calls.find((c) => c.ids)?.ids, ["old"]);
});

test("a failed second page cannot be presented as a complete or zero commercial report", async () => {
  const { client } = mockClient(true);
  await assert.rejects(
    queryCommercialImpact(client, "own", "2026-10-08", "2026-10-08"),
    /todos os registros/,
  );
});
