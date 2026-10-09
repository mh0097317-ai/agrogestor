import test from "node:test";
import assert from "node:assert/strict";
import { activityPeriod, demoActivity } from "../src/lib/platform-activity";
import { createSeed } from "../src/lib/seed";

test("admin period uses São Paulo dates, rejects impossible dates and limits range", () => {
  assert.deepEqual(
    activityPeriod(null, null, new Date("2026-10-07T02:30:00Z")),
    { from: "2026-09-07", to: "2026-10-06" },
  );
  for (const [from, to] of [
    ["2026-02-30", "2026-03-01"],
    ["2026-10-08", "2026-10-07"],
    ["2024-01-01", "2026-01-01"],
    [null, "invalid"],
  ])
    assert.throws(() => activityPeriod(from, to));
});
test("admin metrics count customers once and distinguish cash from booking value and cancellation", () => {
  const store = createSeed();
  const base = store.appointments[0];
  store.appointments = [
    {
      ...base,
      id: "ai1",
      customerId: "c1",
      createdAt: "2026-10-07T13:00:00Z",
      bookingChannel: "assistant_whatsapp",
      price: 50,
      status: "confirmed",
    },
    {
      ...base,
      id: "ai2",
      customerId: "c1",
      createdAt: "2026-10-07T14:00:00Z",
      bookingChannel: "assistant_whatsapp",
      price: 50,
      status: "confirmed",
    },
    {
      ...base,
      id: "cancelled",
      createdAt: "2026-10-07T13:00:00Z",
      bookingChannel: "public_link",
      price: 50,
      status: "cancelled",
    },
  ];
  store.payments = [
    {
      id: "p1",
      businessId: store.business.id,
      appointmentId: "ai1",
      amount: 15,
      method: "pix",
      createdAt: "2026-10-07T13:00:00Z",
    },
    {
      id: "old",
      businessId: store.business.id,
      appointmentId: "ai1",
      amount: 5,
      method: "pix",
      createdAt: "2026-10-06T13:00:00Z",
    },
  ];
  store.productSales = [];
  store.conversations = [];
  const a = demoActivity(store, { from: "2026-10-07", to: "2026-10-07" });
  assert.equal(a.appointments, 2);
  assert.equal(a.bookingCustomers, 1);
  assert.equal(a.assistantCustomers, 1);
  assert.equal(a.cancelled, 1);
  assert.equal(a.publicBookings, 0);
  assert.equal(a.whatsappBookings, 2);
  assert.equal(a.received, 15);
  assert.equal(a.assistantReceived, 15);
  assert.equal(a.bookedValue, 100);
});
