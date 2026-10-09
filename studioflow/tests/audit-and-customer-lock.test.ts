import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAudit } from "../src/lib/audit-summary";
import { customerClash } from "../src/services/server-store";
import { describeMutation } from "../src/services/activity-describe";
import { createSeed } from "../src/lib/seed";

test("audit funnel counts people once and bookings by event", () => {
  const at = "2026-10-09T15:00:00Z";
  const ev = (visitor: string, kind: string, detail = "", referrer = "") => ({
    visitor, kind, detail, device: "celular", referrer, createdAt: at,
  });
  const summary = summarizeAudit([
    ev("a", "view", "", "instagram.com"),
    ev("a", "view"),
    ev("b", "view"),
    ev("a", "agendar"),
    ev("a", "etapa", "inicio"),
    ev("a", "etapa", "dados"),
    ev("a", "agendou"),
    ev("b", "whatsapp"),
    ev("c", "etapa", "inicio"),
  ]);
  assert.equal(summary.visits, 3);
  assert.equal(summary.visitors, 2);
  assert.deepEqual(summary.funnel.map((step) => step.value), [3, 2, 1, 1]);
  assert.equal(summary.clicks.whatsapp, 1);
  assert.equal(summary.referrers[0].label, "direto");
  assert.equal(summary.daily[0].bookings, 1);
});

test("same customer cannot hold two overlapping appointments", () => {
  const store = createSeed();
  const base = store.appointments.find((item) => item.status === "confirmed")!;
  const start = base.start;
  const minutes = (new Date(base.end).getTime() - new Date(start).getTime()) / 60000;
  assert.ok(customerClash(store, base.customerPhone, start, minutes));
  assert.equal(customerClash(store, base.customerPhone, start, minutes, base.id), undefined);
  assert.equal(customerClash(store, "11900000000", start, minutes), undefined);
  const after = new Date(new Date(base.end).getTime()).toISOString();
  assert.equal(customerClash(store, base.customerPhone, after, 30), undefined);
});

test("panel actions are described in plain words", () => {
  const store = createSeed();
  const appointment = store.appointments[0];
  assert.equal(
    describeMutation("appointments", "update", { id: appointment.id, status: "completed" }, store).action,
    "Concluiu o atendimento",
  );
  assert.match(describeMutation("services", "create", { name: "Corte", price: 45 }, store).detail, /Corte/);
});
