import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  applyMembership,
  confirmDeposit,
  depositFor,
  expireHolds,
  formatCpf,
  holdDeposit,
  isValidCpf,
  membershipUsage,
  monthlyRecurring,
} from "../src/lib/payments";
import { isAvailable } from "../src/lib/availability";
import type { Appointment, Membership, Store } from "../src/types";

/** First bookable 30-minute start from `days` ahead, for the seed's team. */
function freeStart(store: Store, days: number) {
  const service = store.services.find((item) => item.active)!;
  const professional = store.professionals.find((person) =>
    service.professionalIds.includes(person.id),
  )!;
  for (let day = days; day < days + 14; day++)
    for (let minutes = 11 * 60; minutes < 23 * 60; minutes += 30) {
      const start = new Date(Date.now() + day * 86400000);
      start.setUTCHours(0, minutes, 0, 0);
      if (
        isAvailable(store, professional, [service.id], start.toISOString(), new Date(), undefined, true)
      )
        return start;
    }
  throw new Error("no free slot");
}

test("sinal: fixo, percentual, teto no preço e mínimo do provedor", () => {
  assert.equal(depositFor({ depositMode: "off", depositValue: 20 }, 50), 0);
  assert.equal(depositFor({ depositMode: "fixed", depositValue: 20 }, 50), 20);
  assert.equal(depositFor({ depositMode: "fixed", depositValue: 80 }, 50), 50);
  assert.equal(
    depositFor({ depositMode: "percent", depositValue: 30 }, 45),
    13.5,
  );
  // Below R$ 5 rounds up to the minimum; services under R$ 5 ask nothing.
  assert.equal(depositFor({ depositMode: "percent", depositValue: 5 }, 40), 5);
  assert.equal(depositFor({ depositMode: "fixed", depositValue: 10 }, 4), 0);
});

test("CPF: dígitos verificadores e máscara", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("52998224724"), false);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("123"), false);
  assert.equal(formatCpf("52998224725"), "529.982.247-25");
  assert.equal(formatCpf("5299"), "529.9");
});

function booking(store: Store, patch: Partial<Appointment>): Appointment {
  const service = store.services.find((item) => item.active)!;
  const professional = store.professionals.find((person) =>
    service.professionalIds.includes(person.id),
  )!;
  const start = patch.start ? new Date(patch.start) : freeStart(store, 3);
  const appointment: Appointment = {
    id: crypto.randomUUID(),
    businessId: store.business.id,
    customerId: store.customers[0].id,
    customerName: "Ana Souza",
    customerPhone: "11987654321",
    serviceIds: [service.id],
    professionalId: professional.id,
    start: start.toISOString(),
    end: new Date(start.getTime() + service.duration * 60000).toISOString(),
    price: service.price,
    status: "confirmed",
    reminder: false,
    createdAt: new Date().toISOString(),
    ...patch,
  };
  store.appointments.push(appointment);
  return appointment;
}

test("reserva com sinal: prazo, liberação e Pix pago depois do prazo", () => {
  const store = createSeed();
  store.appointments = [];
  store.blockedTimes = [];
  const held = booking(store, {});
  holdDeposit(held, 20, 15);
  assert.equal(held.status, "pending");
  assert.throws(() => holdDeposit(held, 20, 15), /invalid deposit/);
  held.depositChargeId = "pay_1";
  assert.equal(confirmDeposit(store, "pay_1", "p1"), "confirmed");
  assert.equal(confirmDeposit(store, "pay_1", "p2"), "already");
  assert.equal(
    store.payments.filter((item) => item.providerChargeId === "pay_1").length,
    1,
  );

  // Expired: released; paid later with the slot still free → back.
  const late = booking(store, { start: freeStart(store, 5).toISOString() });
  holdDeposit(late, 20, 15, new Date(Date.now() - 20 * 60000));
  late.depositChargeId = "pay_2";
  assert.equal(expireHolds(store), 1);
  assert.equal(late.status, "cancelled");
  assert.equal(confirmDeposit(store, "pay_2", "p3"), "confirmed");
  assert.equal(late.status, "confirmed");

  // Expired and taken by someone else → stays cancelled, refund flagged.
  const lost = booking(store, { start: freeStart(store, 7).toISOString() });
  holdDeposit(lost, 20, 15, new Date(Date.now() - 20 * 60000));
  lost.depositChargeId = "pay_3";
  expireHolds(store);
  booking(store, { start: lost.start });
  assert.equal(confirmDeposit(store, "pay_3", "p4"), "refund");
  assert.deepEqual([lost.status, lost.depositStatus], ["cancelled", "paid"]);
  assert.equal(confirmDeposit(store, "nope", "p5"), "unknown");
});

test("clube: assinatura ativa, mesmo WhatsApp, serviços do plano e limite do mês", () => {
  const store = createSeed();
  store.appointments = [];
  const service = store.services.find((item) => item.active)!;
  store.plans = [
    {
      id: "plan-1",
      businessId: store.business.id,
      name: "Clube",
      description: "",
      price: 89.9,
      serviceIds: [service.id],
      monthlyLimit: 1,
      active: true,
      createdAt: "",
    },
  ];
  const member: Membership = {
    id: "m-1",
    businessId: store.business.id,
    planId: "plan-1",
    customerId: store.customers[0].id,
    customerName: "Ana Souza",
    customerPhone: "11987654321",
    price: 89.9,
    status: "pending",
    createdAt: "",
  };
  store.memberships = [member];
  const first = booking(store, {});
  assert.equal(applyMembership(store, first, member), "inactive");
  member.status = "active";
  assert.equal(applyMembership(store, first, undefined), "invalid");
  assert.equal(
    applyMembership(store, booking(store, { customerPhone: "11900000000" }), member),
    "phone",
  );
  assert.equal(
    applyMembership(store, booking(store, { serviceIds: ["other"] }), member),
    "services",
  );
  assert.equal(applyMembership(store, first, member), "covered");
  assert.equal(first.price, 0);
  assert.equal(membershipUsage(store.appointments, "m-1", first.start), 1);
  assert.equal(applyMembership(store, booking(store, {}), member), "limit");
  assert.equal(monthlyRecurring([member, { ...member, status: "cancelled" }]), 89.9);
});

test("chave de API cifrada e token do aviso conferido sem vazar tempo", async () => {
  process.env.SUPABASE_SECRET_KEY ||= "test-server-secret";
  const { decryptSecret, encryptSecret, matchesHash, sha256 } = await import(
    "../src/services/server-secrets"
  );
  const sealed = encryptSecret("$aact_chave_de_teste");
  assert.notEqual(sealed, encryptSecret("$aact_chave_de_teste"));
  assert.equal(sealed.includes("chave"), false);
  assert.equal(decryptSecret(sealed), "$aact_chave_de_teste");
  const tampered = sealed.slice(0, -4) + (sealed.endsWith("A") ? "BBBB" : "AAAA");
  assert.throws(() => decryptSecret(tampered), /Reconecte/);
  assert.equal(matchesHash("token-certo", sha256("token-certo")), true);
  assert.equal(matchesHash("token-errado", sha256("token-certo")), false);
  assert.equal(matchesHash(null, sha256("token-certo")), false);
});
