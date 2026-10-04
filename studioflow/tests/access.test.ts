import test from "node:test";
import assert from "node:assert/strict";
import {
  AccessError,
  accessOpen,
  accessState,
  assertPublicOpen,
  assertWorkspaceOpen,
  daysLeft,
  endOfBusinessDay,
  extendUntil,
} from "../src/lib/access";

const now = new Date("2026-10-04T15:00:00.000Z");
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

test("acesso: estados, prazo e aviso de renovação", () => {
  assert.equal(accessState({ status: "pending", until: null }, now), "pending");
  assert.equal(accessState({ status: "suspended", until: inDays(20) }, now), "suspended");
  assert.equal(accessState({ status: "active", until: null }, now), "active");
  assert.equal(accessState({ status: "active", until: inDays(20) }, now), "active");
  assert.equal(accessState({ status: "active", until: inDays(5) }, now), "expiring");
  assert.equal(accessState({ status: "active", until: inDays(-1) }, now), "expired");
  assert.equal(accessOpen({ status: "active", until: inDays(0.5) }, now), true);
  assert.equal(accessOpen({ status: "suspended", until: null }, now), false);
  assert.equal(daysLeft({ status: "active", until: inDays(2.2) }, now), 3);
  assert.equal(daysLeft({ status: "active", until: null }, now), null);
});

test("acesso: liberar dias soma ao que resta e conta de agora quando venceu", () => {
  assert.equal(extendUntil(inDays(10), 30, now), inDays(40));
  assert.equal(extendUntil(inDays(-3), 30, now), inDays(30));
  assert.equal(extendUntil(null, 7, now), inDays(7));
  assert.equal(endOfBusinessDay("2026-11-04"), "2026-11-05T02:59:59.000Z");
  assert.throws(() => endOfBusinessDay("04/11/2026"));
});

test("acesso: painel e agenda online fecham sem liberação", () => {
  assert.equal(assertWorkspaceOpen({ status: "active", until: inDays(3) }, "Casa", now), "expiring");
  assert.throws(
    () => assertWorkspaceOpen({ status: "pending", until: null }, "Casa", now),
    (error: unknown) =>
      error instanceof AccessError &&
      error.status === 423 &&
      error.access.state === "pending" &&
      error.access.business === "Casa",
  );
  assert.throws(() => assertPublicOpen({ status: "active", until: inDays(-1) }, now), /pausada/);
  assert.doesNotThrow(() => assertPublicOpen({ status: "active", until: null }, now));
});
