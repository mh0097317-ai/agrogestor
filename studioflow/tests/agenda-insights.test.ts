import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  freeWindows,
  weakSpot,
  weekHeat,
} from "../src/features/agenda/agenda-insights";
import type { Appointment } from "../src/types";

// Friday 30/10/2026 as the agenda builds it: local midnight.
const friday = new Date(2026, 9, 30);
const saturday = new Date(2026, 9, 31);
const at = (day: string, hhmm: string) => `${day}T${hhmm}:00-03:00`;

function fixture() {
  const store = createSeed();
  store.appointments = [];
  store.blockedTimes = [];
  store.settings.buffer = 0;
  store.settings.openDays = [1, 2, 3, 4, 5, 6];
  store.settings.openStart = "09:00";
  store.settings.openEnd = "20:00";
  const lucas = store.professionals[0];
  Object.assign(lucas, {
    days: [1, 2, 3, 4, 5, 6],
    start: "09:00",
    end: "20:00",
    breakStart: "12:00",
    breakEnd: "13:00",
  });
  store.professionals = [lucas];
  let n = 0;
  const book = (
    day: string,
    start: string,
    end: string,
    extra: Partial<Appointment> = {},
  ) =>
    store.appointments.push({
      id: `a${++n}`,
      businessId: store.business.id,
      customerId: store.customers[0].id,
      customerName: "Cliente",
      customerPhone: "11999999999",
      serviceIds: [store.services[0].id],
      professionalId: lucas.id,
      start: new Date(at(day, start)).toISOString(),
      end: new Date(at(day, end)).toISOString(),
      price: 45,
      status: "confirmed",
      reminder: true,
      createdAt: new Date(at(day, "08:00")).toISOString(),
      ...extra,
    });
  return { store, lucas, book };
}

test("free windows skip bookings, the break and what has passed", () => {
  const { store, lucas, book } = fixture();
  book("2026-10-30", "09:00", "10:00");
  book("2026-10-30", "10:15", "11:40");
  book("2026-10-30", "13:00", "19:00");
  // Shortest service Lucas does is 20 minutes (sobrancelha).
  const all = freeWindows(store, lucas, friday);
  assert.deepEqual(all, [
    { start: 11 * 60 + 40, end: 12 * 60 },
    { start: 19 * 60, end: 20 * 60 },
  ]);
  // 10:00–10:15 is shorter than any service, so it is not offered.
  assert.ok(!all.some((w) => w.start === 600));
  // At 11:50 only the evening is still ahead.
  assert.deepEqual(freeWindows(store, lucas, friday, 11 * 60 + 50), [
    { start: 19 * 60, end: 20 * 60 },
  ]);
});

test("cancelled bookings free their time and day blocks close it", () => {
  const { store, lucas, book } = fixture();
  book("2026-10-30", "09:00", "12:00", { status: "cancelled" });
  store.blockedTimes.push({
    id: "b1",
    businessId: store.business.id,
    professionalId: lucas.id,
    start: new Date(at("2026-10-30", "13:00")).toISOString(),
    end: new Date(at("2026-10-30", "20:00")).toISOString(),
    reason: "Curso",
  });
  assert.deepEqual(freeWindows(store, lucas, friday), [
    { start: 9 * 60, end: 12 * 60 },
  ]);
  assert.deepEqual(freeWindows(store, lucas, new Date(2026, 10, 1)), []);
});

test("week heat is the booked share of working time per hour", () => {
  const { store, lucas, book } = fixture();
  book("2026-10-30", "09:00", "09:30");
  book("2026-10-30", "10:00", "11:00");
  const heat = weekHeat(store, [friday, new Date(2026, 10, 1)], [lucas]);
  assert.equal(heat.hours[0], 9);
  assert.equal(heat.hours.length, 11);
  // Sunday is closed and left out.
  assert.equal(heat.rows.length, 1);
  const cells = heat.rows[0].cells;
  assert.equal(cells[0], 0.5);
  assert.equal(cells[1], 1);
  assert.equal(cells[2], 0);
  // 12h is the break: no capacity.
  assert.equal(cells[3], null);
});

test("the weakest period ahead is named with the days that look alike", () => {
  const { store, lucas, book } = fixture();
  for (const day of ["2026-10-30", "2026-10-31"]) {
    book(day, "09:00", "12:00");
    book(day, "18:00", "20:00");
  }
  book("2026-10-31", "13:00", "13:30");
  const heat = weekHeat(store, [friday, saturday], [lucas]);
  const spot = weakSpot(store, heat, "2026-10-30");
  assert.ok(spot);
  assert.equal(spot.title, "Pouco movimento sexta e sábado à tarde.");
  assert.match(
    spot.detail,
    /Das 12h às 18h esses dias ficam com 5% das cadeiras ocupadas/,
  );
  // Past days do not count while something is still ahead.
  assert.equal(
    weakSpot(store, heat, "2026-10-31")?.title,
    "Pouco movimento sábado à tarde.",
  );
});

test("a full week has no weak spot", () => {
  const { store, lucas, book } = fixture();
  book("2026-10-30", "09:00", "12:00");
  book("2026-10-30", "13:00", "20:00");
  const heat = weekHeat(store, [friday], [lucas]);
  assert.equal(weakSpot(store, heat, "2026-10-30"), null);
});
