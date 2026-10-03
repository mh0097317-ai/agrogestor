import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  attention,
  occupancy,
  weekRevenue,
} from "../src/features/dashboard/insights";

function store() {
  const s = createSeed();
  s.appointments = [];
  s.payments = [];
  return s;
}
const base = (s: ReturnType<typeof store>) => ({
  businessId: s.business.id,
  customerId: s.customers[0].id,
  customerName: "Teste",
  customerPhone: "11987654321",
  serviceIds: [s.services[2].id],
  reminder: false,
  createdAt: "2026-09-01T12:00:00Z",
});

test("faturamento da semana soma recebimentos por dia e compara com a anterior", () => {
  const s = store();
  s.payments = [
    {
      id: "a",
      businessId: s.business.id,
      appointmentId: "x",
      amount: 100,
      method: "pix",
      createdAt: "2026-10-02T15:00:00Z",
    },
    {
      id: "b",
      businessId: s.business.id,
      appointmentId: "x",
      amount: 50,
      method: "pix",
      createdAt: "2026-09-28T15:00:00Z",
    },
    {
      id: "c",
      businessId: s.business.id,
      appointmentId: "x",
      amount: 100,
      method: "pix",
      createdAt: "2026-09-22T15:00:00Z",
    },
  ];
  const week = weekRevenue(s, "2026-10-02");
  assert.equal(week.rows.length, 7);
  assert.equal(week.rows.at(-1)?.received, 100);
  assert.equal(week.total, 150);
  assert.equal(week.change, 0.5);
});

test("ocupação desconta o almoço e ignora cancelados", () => {
  const s = store();
  const lucas = s.professionals[0]; // 09:00–20:00 com 1h de almoço = 600 min
  s.appointments = [
    {
      ...base(s),
      id: "1",
      professionalId: lucas.id,
      start: "2026-10-02T12:00:00Z",
      end: "2026-10-02T14:00:00Z",
      price: 65,
      status: "confirmed",
    },
    {
      ...base(s),
      id: "2",
      professionalId: lucas.id,
      start: "2026-10-02T15:00:00Z",
      end: "2026-10-02T16:00:00Z",
      price: 65,
      status: "cancelled",
    },
  ];
  const row = occupancy(s, "2026-10-02").find(
    (r) => r.professional.id === lucas.id,
  );
  assert.equal(row?.count, 1);
  assert.equal(row?.ratio, 120 / 600);
});

test("atenção lista pendentes futuros e clientes sumidos", () => {
  const s = store();
  s.appointments = [
    {
      ...base(s),
      id: "p1",
      professionalId: s.professionals[0].id,
      start: "2026-10-03T12:00:00Z",
      end: "2026-10-03T13:00:00Z",
      price: 65,
      status: "pending",
    },
    {
      ...base(s),
      id: "old",
      professionalId: s.professionals[0].id,
      start: "2026-09-01T12:00:00Z",
      end: "2026-09-01T13:00:00Z",
      price: 65,
      status: "pending",
    },
  ];
  s.customers = [
    { ...s.customers[0], lastVisit: "2026-08-20", returnInterval: 20 },
  ];
  const result = attention(s, Date.parse("2026-10-02T12:00:00Z"));
  assert.deepEqual(
    result.pending.map((a) => a.id),
    ["p1"],
  );
  assert.equal(result.lapsedTotal, 1);
  assert.equal(result.lapsed[0].days, 43);
});
