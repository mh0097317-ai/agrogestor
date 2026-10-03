import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  balanceFor,
  financeSummary,
  inPeriod,
  periodFor,
  validPeriod,
} from "../src/features/management/finance-helpers";

function fixture() {
  const data = createSeed();
  const base = data.appointments[0];
  data.appointments = [
    {
      ...base,
      id: "completed",
      customerId: "customer-a",
      price: 65,
      status: "completed",
      professionalId: data.professionals[0].id,
      serviceIds: [data.services[0].id],
      start: "2026-10-02T09:00:00-03:00",
      end: "2026-10-02T09:40:00-03:00",
    },
    {
      ...base,
      id: "previous",
      customerId: "customer-b",
      price: 45,
      status: "completed",
      professionalId: data.professionals[1].id,
      serviceIds: [data.services[1].id],
      start: "2026-09-30T09:00:00-03:00",
      end: "2026-09-30T09:40:00-03:00",
    },
    {
      ...base,
      id: "missed",
      price: 100,
      status: "no_show",
      start: "2026-10-02T10:00:00-03:00",
      end: "2026-10-02T10:40:00-03:00",
    },
    {
      ...base,
      id: "confirmed",
      price: 100,
      status: "confirmed",
      start: "2026-10-02T11:00:00-03:00",
      end: "2026-10-02T11:40:00-03:00",
    },
  ];
  data.payments = [
    {
      id: "older",
      businessId: data.business.id,
      appointmentId: "completed",
      amount: 20,
      method: "cash",
      createdAt: "2026-10-01T16:00:00-03:00",
    },
    {
      id: "partial",
      businessId: data.business.id,
      appointmentId: "completed",
      amount: 30,
      method: "pix",
      createdAt: "2026-10-02T16:00:00-03:00",
    },
    {
      id: "late",
      businessId: data.business.id,
      appointmentId: "previous",
      amount: 45,
      method: "debit",
      createdAt: "2026-10-02T17:00:00-03:00",
    },
  ];
  data.customers = [];
  return data;
}

test("períodos usam o calendário de São Paulo e sete dias inclusivos", () => {
  const now = new Date("2026-10-03T02:30:00Z");
  assert.deepEqual(periodFor("today", now), {
    from: "2026-10-02",
    to: "2026-10-02",
  });
  assert.deepEqual(periodFor("week", now), {
    from: "2026-09-26",
    to: "2026-10-02",
  });
  assert.deepEqual(periodFor("month", now), {
    from: "2026-10-01",
    to: "2026-10-02",
  });
  assert.equal(inPeriod("2026-10-03T02:30:00Z", periodFor("today", now)), true);
  assert.equal(
    inPeriod("2026-10-03T03:00:00Z", periodFor("today", now)),
    false,
  );
});
test("intervalos inválidos ou invertidos não produzem métricas", () => {
  assert.equal(validPeriod({ from: "2026-02-30", to: "2026-03-01" }), false);
  assert.equal(validPeriod({ from: "2026-10-03", to: "2026-10-02" }), false);
  assert.equal(validPeriod(periodFor("all")), true);
  const summary = financeSummary(fixture(), {
    from: "2026-10-03",
    to: "2026-10-02",
  });
  assert.equal(summary.revenueCents, 0);
  assert.equal(summary.completed.length, 0);
});
test("recebimentos seguem data do pagamento mesmo para serviços antigos", () => {
  const data = fixture();
  const summary = financeSummary(data, {
    from: "2026-10-02",
    to: "2026-10-02",
  });
  assert.equal(summary.revenueCents, 7500);
  assert.equal(summary.payments.length, 2);
  assert.equal(summary.completed.length, 1);
  assert.equal(summary.averageTicketCents, 6500);
  assert.equal(summary.averageReceiptCents, 3750);
  assert.equal(summary.services[0].service.id, data.services[0].id);
  assert.equal(summary.services.length, 1);
  assert.equal(
    summary.professionals.find(
      (item) => item.professional.id === data.professionals[1].id,
    )?.receivedCents,
    4500,
  );
});
test("saldo aberto considera pagamentos fora do período e somente concluídos", () => {
  const data = fixture();
  const summary = financeSummary(data, {
    from: "2026-10-02",
    to: "2026-10-02",
  });
  assert.equal(summary.dueCents, 1500);
  assert.equal(summary.outstanding.length, 1);
  assert.equal(summary.outstanding[0].appointment.id, "completed");
  assert.equal(summary.attendance, 50);
  assert.equal(summary.clientsCount, 1);
  assert.equal(balanceFor(data.appointments[1], data), 0);
});
test("comissões são estimadas com percentual atual e arredondadas em centavos", () => {
  const data = fixture();
  data.professionals[0].commission = 33.3;
  data.professionals[1].commission = 40;
  const summary = financeSummary(data, {
    from: "2026-10-02",
    to: "2026-10-02",
  });
  assert.equal(
    summary.professionals[0].professional.id,
    data.professionals[1].id,
  );
  assert.equal(
    summary.professionals.find(
      (item) => item.professional.id === data.professionals[0].id,
    )?.commissionCents,
    999,
  );
  assert.equal(summary.commissionCents, 2799);
});
test("pagamentos fracionados mantêm centavos e agregam um atendimento", () => {
  const data = fixture();
  data.appointments = [{ ...data.appointments[0], price: 0.3 }];
  data.payments = data.payments
    .slice(0, 2)
    .map((payment, index) => ({
      ...payment,
      amount: index ? 0.2 : 0.1,
      createdAt: "2026-10-02T16:00:00-03:00",
    }));
  const summary = financeSummary(data, {
    from: "2026-10-02",
    to: "2026-10-02",
  });
  assert.equal(summary.revenueCents, 30);
  assert.equal(summary.paidCount, 1);
  assert.equal(summary.dueCents, 0);
  assert.equal(summary.averageReceiptCents, 30);
});
