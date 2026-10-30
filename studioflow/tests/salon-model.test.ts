import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { salonModel } from "../src/features/dashboard/salon-model";
import type { Appointment } from "../src/types";

// Friday 30/10/2026, 14:32 in São Paulo.
const now = Date.parse("2026-10-30T17:32:00Z");
const at = (hhmm: string) => `2026-10-30T${hhmm}:00-03:00`;
function fixture() {
  const store = createSeed();
  store.appointments = [];
  store.payments = [];
  const people = store.professionals.filter((p) => p.active).slice(0, 4);
  store.professionals = people;
  for (const p of people) {
    p.days = [1, 2, 3, 4, 5, 6];
    p.start = "09:00";
    p.end = "20:00";
    p.breakStart = "";
    p.breakEnd = "";
  }
  const service = store.services.find((s) => s.active)!;
  let n = 0;
  const book = (
    pro: number,
    start: string,
    end: string,
    status: Appointment["status"],
    extra: Partial<Appointment> = {},
  ) => {
    const a = {
      id: `a${++n}`,
      businessId: store.business.id,
      customerId: `c${n}`,
      customerName: `Cliente ${n}`,
      customerPhone: "11999990000",
      serviceIds: [service.id],
      professionalId: people[pro].id,
      start: new Date(at(start)).toISOString(),
      end: new Date(at(end)).toISOString(),
      price: 65,
      status,
      reminder: true,
      createdAt: "2026-10-20T12:00:00Z",
      ...extra,
    } as Appointment;
    store.appointments.push(a);
    return a;
  };
  return { store, people, book };
}

test("each chair shows what is happening now", () => {
  const { store, people, book } = fixture();
  const busy = book(0, "14:05", "15:05", "in_progress");
  const late = book(1, "13:50", "14:30", "in_progress");
  book(2, "15:30", "16:10", "confirmed");
  people[3].breakStart = "14:00";
  people[3].breakEnd = "15:00";
  const model = salonModel(store, now);
  const [c0, c1, c2, c3] = model.chairs;
  assert.equal(c0.state, "busy");
  assert.equal(c0.current?.id, busy.id);
  assert.equal(c0.minutesLeft, 33);
  assert.ok(c0.progress > 0.4 && c0.progress < 0.5);
  assert.equal(c1.state, "late");
  assert.equal(c1.current?.id, late.id);
  assert.ok(c1.minutesLeft < 0);
  assert.equal(c2.state, "free");
  assert.equal(c2.freeUntil, "15:30");
  assert.equal(c3.state, "break");
  assert.equal(c3.freeUntil, "15:00");
});

test("a booking due now that was not started asks to start it", () => {
  const { store, book } = fixture();
  book(0, "14:30", "15:10", "confirmed");
  assert.equal(salonModel(store, now).chairs[0].state, "due");
});

test("checked-in clients wait, today's money and the first gap are counted", () => {
  const { store, people, book } = fixture();
  const done = book(0, "09:00", "09:40", "completed");
  store.payments.push({
    id: "p1",
    businessId: store.business.id,
    appointmentId: done.id,
    amount: 45,
    method: "pix",
    createdAt: "2026-10-30T13:00:00Z",
  });
  const waiting = book(1, "14:45", "15:05", "confirmed", {
    checkedInAt: "2026-10-30T17:26:00Z",
  });
  book(0, "14:30", "17:00", "in_progress");
  const model = salonModel(store, now);
  assert.equal(model.cash, 45);
  assert.equal(model.done, 1);
  assert.deepEqual(
    model.waiting.map((a) => a.id),
    [waiting.id],
  );
  assert.deepEqual(
    model.chairs[1].waiting.map((a) => a.id),
    [waiting.id],
  );
  assert.ok(model.gap);
  assert.equal(model.gap!.start, "14:40");
  assert.notEqual(model.gap!.professional.id, people[0].id);
  assert.match(
    model.feed.map((e) => e.text).join("\n"),
    /chegou e fez check-in/,
  );
});

test("off day and outside hours read as off", () => {
  const { store, people } = fixture();
  people[0].days = [1];
  people[1].end = "14:00";
  const model = salonModel(store, now);
  assert.equal(model.chairs[0].state, "off");
  assert.equal(model.chairs[1].state, "off");
});

test("chairs in use, the average wait and yesterday are measured for the top cards", () => {
  const { store, book } = fixture();
  book(0, "14:05", "15:05", "in_progress");
  book(1, "13:50", "14:30", "in_progress");
  book(2, "14:45", "15:25", "confirmed", { checkedInAt: at("14:22") });
  book(3, "15:00", "15:20", "confirmed", { checkedInAt: at("14:12") });
  // Yesterday: two bookings, one paid in the morning and one at night.
  const y1 = book(0, "09:00", "09:40", "completed");
  y1.start = new Date("2026-10-29T09:00:00-03:00").toISOString();
  y1.end = new Date("2026-10-29T09:40:00-03:00").toISOString();
  const y2 = book(1, "19:00", "19:40", "completed");
  y2.start = new Date("2026-10-29T19:00:00-03:00").toISOString();
  y2.end = new Date("2026-10-29T19:40:00-03:00").toISOString();
  store.payments.push(
    {
      id: "p1",
      businessId: store.business.id,
      appointmentId: y1.id,
      amount: 40,
      method: "pix",
      createdAt: new Date("2026-10-29T09:45:00-03:00").toISOString(),
    },
    {
      id: "p2",
      businessId: store.business.id,
      appointmentId: y2.id,
      amount: 60,
      method: "pix",
      createdAt: new Date("2026-10-29T19:45:00-03:00").toISOString(),
    },
  );
  const model = salonModel(store, now);
  assert.equal(model.inUse, 2);
  assert.equal(model.working, 4);
  // Waiting since 14:22 and 14:12 at 14:32: 10 and 20 minutes.
  assert.equal(model.waitMinutes, 15);
  assert.equal(model.yesterday.total, 2);
  // Only what had come in by 14:32 yesterday counts.
  assert.equal(model.yesterday.cash, 40);
});
