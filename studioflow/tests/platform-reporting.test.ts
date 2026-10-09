import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateActivity,
  billingSummary,
  businessReport,
  invoiceState,
  receptionistState,
  reportCsv,
  type AdminInvoice,
} from "../src/lib/platform-reporting";
import { emptyActivity } from "../src/lib/platform-activity";
import { searchPlatform } from "../src/features/platform/platform-summary";
import type { PlatformBusiness } from "../src/services/platform";
const period = { from: "2026-10-01", to: "2026-10-07" };
const business = (name: string): PlatformBusiness => ({
  id: name,
  name,
  slug: name,
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
  activity: emptyActivity(),
});
const invoice = (
  id: string,
  status: AdminInvoice["status"],
  value: number,
  dueDate: string,
  paidAt: string | null,
): AdminInvoice => ({
  id,
  businessId: "a",
  status,
  value,
  dueDate,
  paidAt,
  invoiceUrl: "",
  createdAt: "2026-09-01T12:00:00Z",
});
test("platform receipts use payment day in Sao Paulo, exclude cancelled invoices and show current debt independently of the selected period", () => {
  const rows = [
    invoice("boundary-out", "paid", 10, "2026-10-01", "2026-10-01T01:00:00Z"),
    invoice("boundary-in", "paid", 79.9, "2026-10-01", "2026-10-01T03:00:00Z"),
    invoice("last-day", "paid", 0.1, "2026-10-01", "2026-10-08T02:59:59Z"),
    invoice("next-day", "paid", 20, "2026-10-01", "2026-10-08T03:00:00Z"),
    invoice("cancelled", "cancelled", 100, "2026-10-01", null),
    invoice("old-pending", "pending", 49.9, "2026-09-01", null),
    invoice("due-today", "pending", 0.2, "2026-10-07", null),
  ];
  assert.deepEqual(billingSummary(rows, period, "2026-10-07"), {
    received: 80,
    paid: 2,
    outstanding: 50.1,
    pending: 2,
    overdue: 49.9,
    overdueCount: 1,
  });
  assert.equal(invoiceState(rows[6], "2026-10-07"), "pending");
});
test("receptionist readiness requires the module, active access, both providers and an open connection independently of public booking", () => {
  const item = business("A");
  const ready = { evolution: true, ai: true };
  assert.equal(receptionistState(item, ready).id, "ready");
  item.modules = [];
  assert.equal(receptionistState(item, ready).id, "plan");
  item.modules = null;
  item.assistantEnabled = false;
  assert.equal(receptionistState(item, ready).id, "disabled");
  item.assistantEnabled = true;
  item.state = "expired";
  assert.equal(receptionistState(item, ready).id, "access");
  item.state = "active";
  assert.equal(
    receptionistState(item, { ...ready, ai: false }).id,
    "configuration",
  );
  item.whatsappStatus = "connecting";
  assert.equal(receptionistState(item, ready).id, "connecting");
  item.whatsappStatus = "close";
  assert.equal(receptionistState(item, ready).id, "disconnected");
});
test("CSV reports escape quotes, newlines and spreadsheet formulas and retain Brazilian decimal precision", () => {
  const csv = reportCsv([
    ['=HYPERLINK("x")', "  +cmd", "@SUM(1)", "a;b\ntexto", 79.9, 5],
  ]);
  assert.equal(
    csv,
    '\uFEFF"\'=HYPERLINK(""x"")";"\'  +cmd";"\'@SUM(1)";"a;b\ntexto";"79,9";"5"',
  );
});
test("business exports and rankings use the actual requested period's activity instead of the old 30 day metric", () => {
  const items = [business("A"), business("B")];
  items[0].appointments30d = 99;
  items[1].activity.appointments = 2;
  items[1].activity.assistantBookings = 1;
  items[1].activity.received = 79.9;
  assert.equal(searchPlatform(items, "", "bookings")[0].name, "B");
  assert.equal(searchPlatform(items, "", "ai")[0].name, "B");
  assert.equal(searchPlatform(items, "", "revenue")[0].name, "B");
  assert.equal(items[0].name, "A");
  assert.equal(aggregateActivity(items).appointments, 2);
  assert.equal(aggregateActivity(items).received, 79.9);
  const csv = businessReport(items.slice(1), period);
  assert.ok(csv.includes('"79,9"'));
  assert.ok(csv.includes('"2026-10-01";"2026-10-07"'));
  assert.ok(!csv.includes('"99"'));
});
