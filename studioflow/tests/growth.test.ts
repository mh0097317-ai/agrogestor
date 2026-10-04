import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { completedVisits, loyaltyProgress } from "../src/lib/loyalty";
import {
  reminderMessage,
  tomorrowReminders,
  waitlistMessage,
  waitlistQueue,
} from "../src/features/dashboard/growth";
import type { Appointment, WaitlistEntry } from "../src/types";

const now = Date.parse("2026-10-05T15:00:00Z"); // segunda, 12:00 em São Paulo

function store() {
  const s = createSeed();
  s.appointments = [];
  s.waitlist = [];
  return s;
}
function appointment(
  s: ReturnType<typeof store>,
  id: string,
  start: string,
  status: Appointment["status"] = "confirmed",
): Appointment {
  return {
    id,
    businessId: s.business.id,
    customerId: s.customers[0].id,
    customerName: "Matheus Henrique",
    customerPhone: "62991234567",
    professionalId: s.professionals[0].id,
    serviceIds: [s.services[0].id],
    start,
    end: new Date(Date.parse(start) + 40 * 60000).toISOString(),
    price: 45,
    status,
    reminder: id === "a",
    createdAt: "2026-10-01T12:00:00Z",
  };
}

test("cartão fidelidade: carimbos, cartão completo e novo ciclo", () => {
  assert.deepEqual(loyaltyProgress(0, 10), {
    stamps: 0,
    goal: 10,
    rewardReady: false,
    missing: 10,
  });
  assert.deepEqual(loyaltyProgress(7, 10), {
    stamps: 7,
    goal: 10,
    rewardReady: false,
    missing: 3,
  });
  assert.equal(loyaltyProgress(10, 10).rewardReady, true);
  assert.equal(loyaltyProgress(10, 10).stamps, 10);
  // The reward visit starts the next card.
  assert.deepEqual(loyaltyProgress(11, 10), {
    stamps: 1,
    goal: 10,
    rewardReady: false,
    missing: 9,
  });
  assert.equal(loyaltyProgress(20, 10).rewardReady, true);
  assert.equal(
    completedVisits(
      [
        { customerId: "c", status: "completed" },
        { customerId: "c", status: "cancelled" },
        { customerId: "d", status: "completed" },
      ],
      "c",
    ),
    1,
  );
});

test("lembretes: só os horários de amanhã que ainda vão acontecer", () => {
  const s = store();
  s.appointments = [
    appointment(s, "b", "2026-10-06T19:00:00Z"),
    appointment(s, "a", "2026-10-06T12:00:00Z"),
    appointment(s, "c", "2026-10-06T13:00:00Z", "cancelled"),
    appointment(s, "d", "2026-10-05T18:00:00Z"),
    // 23:30 de terça em São Paulo já é quarta em UTC: continua sendo amanhã.
    appointment(s, "e", "2026-10-07T02:30:00Z", "pending"),
  ];
  assert.deepEqual(
    tomorrowReminders(s, now).map((a) => a.id),
    ["a", "b", "e"],
  );
  const message = reminderMessage(s, s.appointments[1]);
  assert.match(message, /^Olá, Matheus!/);
  assert.match(message, /09:00/);
  assert.match(message, new RegExp(s.business.name));
  assert.match(message, new RegExp(s.services[0].name));
});

test("lista de espera: dias com cancelamento primeiro e sem datas passadas", () => {
  const s = store();
  const entry = (
    id: string,
    desiredDate: string,
    createdAt: string,
  ): WaitlistEntry => ({
    id,
    businessId: s.business.id,
    serviceId: s.services[0].id,
    professionalId: null,
    desiredDate,
    period: "any",
    customerName: `Cliente ${id}`,
    customerPhone: "11987654321",
    status: "waiting",
    createdAt,
  });
  s.waitlist = [
    entry("old", "2026-10-04", "2026-10-01T10:00:00Z"),
    entry("later", "2026-10-09", "2026-10-02T10:00:00Z"),
    entry("first", "2026-10-07", "2026-10-02T10:00:00Z"),
    entry("opened", "2026-10-10", "2026-10-03T10:00:00Z"),
  ];
  s.appointments = [appointment(s, "x", "2026-10-10T14:00:00Z", "cancelled")];
  const queue = waitlistQueue(s, now);
  assert.deepEqual(
    queue.map((item) => item.entry.id),
    ["opened", "first", "later"],
  );
  assert.equal(queue[0].opening, true);
  const message = waitlistMessage(s, s.waitlist[3], "https://x.test/agendar");
  assert.match(message, /^Olá, Cliente!/);
  assert.match(message, /sábado, 10\/10/);
  assert.match(message, /https:\/\/x\.test\/agendar$/);
});
