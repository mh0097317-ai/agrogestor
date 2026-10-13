import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  monthRecap,
  previousMonth,
  recapMonth,
} from "../src/features/dashboard/month-recap-model";
import type { Appointment } from "../src/types";

function store() {
  const s = createSeed();
  s.appointments = [];
  s.payments = [];
  s.productSales = [];
  s.reviews = [];
  return s;
}

function visit(
  s: ReturnType<typeof store>,
  id: string,
  extra: Partial<Appointment>,
): Appointment {
  return {
    id,
    businessId: s.business.id,
    customerId: s.customers[0].id,
    customerName: s.customers[0].name,
    customerPhone: "11987654321",
    serviceIds: [s.services[0].id],
    professionalId: s.professionals[0].id,
    start: "2026-10-10T13:00:00Z",
    end: "2026-10-10T13:40:00Z",
    price: 45,
    status: "completed",
    reminder: true,
    createdAt: "2026-10-05T13:00:00Z",
    ...extra,
  };
}

test("primeira semana mostra o mês que fechou; depois, o mês corrente", () => {
  assert.deepEqual(recapMonth(new Date("2026-10-03T15:00:00Z")), {
    month: "2026-09",
    closed: true,
  });
  assert.deepEqual(recapMonth(new Date("2026-10-20T15:00:00Z")), {
    month: "2026-10",
    closed: false,
  });
  assert.equal(previousMonth("2026-01"), "2025-12");
});

test("retrospectiva soma atendimentos, caixa, agenda online e destaques do mês", () => {
  const s = store();
  s.settings.openDays = [1, 2, 3, 4, 5, 6];
  s.settings.openStart = "09:00";
  s.settings.openEnd = "20:00";
  s.appointments = [
    visit(s, "1", { bookingChannel: "public_link", createdAt: "2026-10-06T02:00:00Z" }), // 23:00 em SP: fora do horário
    visit(s, "2", { bookingChannel: "assistant_whatsapp", createdAt: "2026-10-07T15:00:00Z" }),
    visit(s, "3", { bookingChannel: "manual" }),
    visit(s, "4", { status: "no_show", reminder: false }),
    visit(s, "5", { status: "cancelled", bookingChannel: "public_link" }),
    visit(s, "6", { start: "2026-09-10T13:00:00Z", createdAt: "2026-09-01T13:00:00Z" }),
  ];
  s.payments = [
    { id: "p1", businessId: s.business.id, appointmentId: "1", amount: 45, method: "pix", createdAt: "2026-10-10T14:00:00Z" },
    { id: "p2", businessId: s.business.id, appointmentId: "6", amount: 45, method: "pix", createdAt: "2026-09-10T14:00:00Z" },
  ];
  s.productSales = [
    { id: "v1", businessId: s.business.id, customerName: "X", items: [], total: 30, method: "pix", status: "paid", createdAt: "2026-10-10T14:00:00Z" },
    { id: "v2", businessId: s.business.id, customerName: "X", items: [], total: 99, method: "pix", status: "cancelled", createdAt: "2026-10-10T14:00:00Z" },
  ];
  s.reviews = [
    { id: "r1", businessId: s.business.id, appointmentId: "1", professionalId: s.professionals[0].id, customerName: "A", rating: 5, comment: "", createdAt: "2026-10-11T12:00:00Z" },
    { id: "r2", businessId: s.business.id, appointmentId: "2", professionalId: s.professionals[0].id, customerName: "B", rating: 4, comment: "", createdAt: "2026-10-11T12:00:00Z" },
  ];
  const recap = monthRecap(s, "2026-10");
  assert.equal(recap.completed, 3);
  assert.equal(recap.lastCompleted, 1);
  assert.equal(recap.growth, 200);
  assert.equal(recap.revenue, 75);
  assert.equal(recap.online, 2);
  assert.equal(recap.assistant, 1);
  assert.equal(recap.afterHours, 1);
  assert.equal(recap.noShows, 1);
  assert.equal(recap.attendance, 75);
  assert.equal(recap.reminded, 3);
  assert.equal(recap.topService?.count, 3);
  assert.equal(recap.topProfessional?.count, 3);
  assert.equal(recap.regular && recap.regular.count, 3);
  assert.equal(recap.rating?.average, 4.5);
  assert.equal(recap.name, "outubro");
});
