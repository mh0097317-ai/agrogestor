import test from "node:test";
import assert from "node:assert/strict";
import {
  commercialImpact,
  type ImpactAppointment,
  type ImpactPayment,
} from "../src/lib/commercial-impact";

const booking: ImpactAppointment = {
  id: "old",
  businessId: "own",
  bookingChannel: "assistant_whatsapp",
  createdAt: "2026-09-29T15:00:00Z",
  start: "2026-09-30T15:00:00Z",
  status: "completed",
};
const payment: ImpactPayment = {
  id: "receipt",
  businessId: "own",
  appointmentId: "old",
  amount: 10.1,
  createdAt: "2026-10-09T02:30:00Z",
};

test("commercial attribution separates creation, scheduled status and receipts in São Paulo", () => {
  const output = commercialImpact(
    {
      businessId: "own",
      appointments: [
        booking,
        {
          ...booking,
          id: "cancelled",
          createdAt: "2026-10-08T14:00:00Z",
          start: "2026-10-08T17:00:00Z",
          status: "cancelled",
        },
        {
          ...booking,
          id: "no-show",
          bookingChannel: "assistant_web",
          createdAt: "2026-10-07T15:00:00Z",
          start: "2026-10-08T17:00:00Z",
          status: "no_show",
        },
        {
          ...booking,
          id: "attended",
          bookingChannel: "public_link",
          start: "2026-10-08T17:00:00Z",
        },
        {
          ...booking,
          id: "unknown",
          bookingChannel: undefined,
          createdAt: "2026-10-08T10:00:00Z",
        },
        {
          ...booking,
          id: "foreign",
          businessId: "another-shop",
          createdAt: "2026-10-08T10:00:00Z",
        },
      ],
      payments: [
        payment,
        { ...payment },
        { ...payment, id: "other-part", amount: 20.2 },
        {
          ...payment,
          id: "future",
          createdAt: "2026-10-09T03:00:00Z",
          amount: 999,
        },
        { ...payment, id: "foreign", businessId: "another-shop", amount: 999 },
        { ...payment, id: "public", appointmentId: "attended", amount: 40 },
      ],
    },
    "2026-10-08",
    "2026-10-08",
  );
  assert.deepEqual(output.assistant, {
    created: 1,
    completed: 0,
    cancelled: 1,
    noShow: 1,
    receivedCents: 3030,
  });
  assert.equal(
    output.channels.find((c) => c.key === "public_link")?.completed,
    1,
  );
  assert.equal(
    output.channels.find((c) => c.key === "public_link")?.receivedCents,
    4000,
  );
  assert.equal(output.channels.find((c) => c.key === "legacy")?.created, 1);
});

test("manual and old unattributed reservations never become artificial AI results", () => {
  const manual = { ...booking, bookingChannel: "manual" as const };
  const output = commercialImpact(
    { businessId: "own", appointments: [manual], payments: [payment] },
    "2026-09-01",
    "2026-10-31",
  );
  assert.equal(output.assistant.created, 0);
  assert.equal(output.assistant.receivedCents, 0);
  assert.equal(
    output.channels.find((c) => c.key === "manual")?.receivedCents,
    1010,
  );
});
