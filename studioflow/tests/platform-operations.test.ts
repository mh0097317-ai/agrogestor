import assert from "node:assert/strict";
import test from "node:test";
import {
  businessOperations,
  matchesOperation,
} from "../src/lib/platform-operations";
import { emptyActivity } from "../src/lib/platform-activity";
import type { PlatformBusiness } from "../src/services/platform";
import type { AdminInvoice } from "../src/lib/platform-reporting";

const item = (): PlatformBusiness => ({
  id: "a",
  name: "Loja A",
  slug: "loja-a",
  category: "Barbearia",
  phone: "",
  image: "",
  createdAt: "2026-10-01T12:00:00Z",
  status: "active",
  until: null,
  note: "",
  state: "active",
  ownerName: "",
  ownerEmail: "",
  lastSignInAt: null,
  appointments30d: 0,
  customers: 0,
  lastAppointmentAt: null,
  modules: null,
  plan: "",
  price: null,
  onlineBookingEnabled: false,
  assistantEnabled: true,
  whatsappStatus: "open",
  aiConfigured: true,
  activity: emptyActivity(),
});
const invoice = (
  id: string,
  businessId: string,
  dueDate: string,
  value: number,
  status: AdminInvoice["status"] = "pending",
): AdminInvoice => ({
  id,
  businessId,
  dueDate,
  value,
  status,
  paidAt: null,
  createdAt: "2026-01-01T12:00:00Z",
  invoiceUrl: "",
});
const ready = { evolution: true, ai: false };

test("operational debt isolates tenants, counts today's due date as open and keeps exact monetary sums", () => {
  const row = businessOperations(
    item(),
    [
      invoice("old", "a", "2026-09-01", 79.9),
      invoice("today", "a", "2026-10-07", 0.1),
      invoice("other", "b", "2026-09-01", 999),
      invoice("paid", "a", "2026-09-01", 200, "paid"),
      invoice("cancelled", "a", "2026-09-01", 400, "cancelled"),
    ],
    ready,
    "2026-10-07",
  );
  assert.equal(row.outstanding, 80);
  assert.equal(row.overdue, 79.9);
  assert.equal(row.openInvoices, 2);
  assert.equal(row.overdueInvoices, 1);
  assert.equal(matchesOperation(row, "overdue"), true);
});
test("unavailable billing data stays unknown instead of reporting zero debt", () => {
  const row = businessOperations(item(), null, ready, "2026-10-07");
  assert.equal(row.outstanding, null);
  assert.equal(row.overdueInvoices, null);
  assert.equal(matchesOperation(row, "overdue"), false);
});
test("public booking may be disabled while WhatsApp is fully ready", () => {
  const row = businessOperations(item(), [], ready, "2026-10-07");
  assert.equal(row.receptionist.id, "ready");
  assert.deepEqual(row.reasons, []);
  assert.equal(matchesOperation(row, "ready"), true);
});
test("a disabled or uncontracted receptionist does not produce provider alerts", () => {
  for (const fields of [{ assistantEnabled: false }, { modules: [] }]) {
    const row = businessOperations(
      { ...item(), ...fields, aiConfigured: false, whatsappStatus: "close" },
      [],
      { evolution: false, ai: false },
      "2026-10-07",
    );
    assert.deepEqual(row.reasons, []);
    assert.equal(matchesOperation(row, "vault"), false);
  }
});
test("AI fallback avoids false vault alerts while human handoff and disconnected numbers remain actionable", () => {
  const business = {
    ...item(),
    aiConfigured: false,
    whatsappStatus: "close" as const,
    activity: { ...emptyActivity(), waitingHuman: 3 },
  };
  const row = businessOperations(
    business,
    [],
    { evolution: true, ai: true },
    "2026-10-07",
  );
  assert.equal(row.missingAi, false);
  assert.equal(matchesOperation(row, "vault"), false);
  assert.equal(matchesOperation(row, "human"), true);
  assert.equal(matchesOperation(row, "attention"), true);
  assert.equal(row.reasons.length, 2);
});
