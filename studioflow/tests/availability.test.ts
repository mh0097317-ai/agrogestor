import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  availableSlots,
  isAvailable,
  nextFreeByProfessional,
  normalizePhone,
} from "../src/lib/availability";

function fixture() {
  const store = createSeed();
  store.appointments = [];
  store.blockedTimes = [];
  store.settings.minNotice = 0;
  return store;
}
const date = "2026-10-05",
  now = new Date("2026-10-01T00:00:00Z");
test("serviço completo não cabe antes de outro atendimento", () => {
  const store = fixture(),
    person = store.professionals[0],
    combo = store.services[2];
  store.appointments.push({
    id: "existing",
    businessId: store.business.id,
    customerId: store.customers[0].id,
    customerName: "Teste",
    customerPhone: "11987654321",
    serviceIds: [combo.id],
    professionalId: person.id,
    start: `${date}T15:30:00-03:00`,
    end: `${date}T16:30:00-03:00`,
    price: 65,
    status: "confirmed",
    reminder: false,
    createdAt: now.toISOString(),
  });
  assert.equal(
    isAvailable(store, person, [combo.id], `${date}T15:00:00-03:00`, now),
    false,
  );
  assert.equal(
    isAvailable(store, person, [combo.id], `${date}T14:30:00-03:00`, now),
    true,
  );
});
test("intervalos, expediente, folga e bloqueio são respeitados", () => {
  const store = fixture(),
    person = store.professionals[0],
    service = store.services[0];
  assert.equal(
    isAvailable(store, person, [service.id], `${date}T11:30:00-03:00`, now),
    false,
  );
  assert.equal(
    isAvailable(store, person, [service.id], `${date}T19:30:00-03:00`, now),
    false,
  );
  assert.equal(
    isAvailable(store, person, [service.id], "2026-10-04T09:00:00-03:00", now),
    false,
  );
  store.blockedTimes.push({
    id: "block",
    businessId: store.business.id,
    professionalId: person.id,
    start: `${date}T10:00:00-03:00`,
    end: `${date}T11:00:00-03:00`,
    reason: "Folga",
  });
  assert.equal(
    isAvailable(store, person, [service.id], `${date}T09:30:00-03:00`, now),
    false,
  );
});
test("buffer impede atendimento colado e limite de antecedência", () => {
  const store = fixture(),
    person = store.professionals[0],
    service = store.services[0];
  store.settings.buffer = 20;
  assert.equal(
    isAvailable(store, person, [service.id], `${date}T11:10:00-03:00`, now),
    false,
  );
  store.settings.maxDays = 2;
  assert.equal(availableSlots(store, [service.id], "any", date, now).length, 0);
});
test("qualquer profissional retorna somente pessoas capacitadas", () => {
  const store = fixture(),
    service = store.services[3];
  const slots = availableSlots(store, [service.id], "any", date, now);
  assert.ok(slots.length > 0);
  assert.ok(
    slots.every((slot) =>
      service.professionalIds.includes(slot.professionalId),
    ),
  );
  store.services[3].professionalIds = [];
  assert.equal(availableSlots(store, [service.id], "any", date, now).length, 0);
});
test("IDs de outra empresa não executam serviços nem influenciam a disponibilidade", () => {
  const store = fixture(),
    person = { ...store.professionals[0], businessId: "another" };
  assert.equal(
    isAvailable(
      store,
      person,
      [store.services[0].id],
      `${date}T09:00:00-03:00`,
      now,
    ),
    false,
  );
  assert.throws(() =>
    availableSlots(store, ["another-business-service"], "any", date, now),
  );
});
test("WhatsApp brasileiro exige DDD válido, nono dígito e aceita +55", () => {
  assert.equal(normalizePhone("+55 (11) 98765-4321"), "11987654321");
  for (const value of [
    "(20) 98765-4321",
    "1198765432",
    "11876543210",
    "11111111111",
  ])
    assert.throws(() => normalizePhone(value));
});
test("próximo horário livre por profissional respeita agenda e quem faz o serviço", () => {
  const store = fixture(),
    combo = store.services[2],
    lucas = store.professionals[0];
  const monday = new Date("2026-10-05T11:00:00Z"); // 08:00 em São Paulo
  store.appointments.push({
    id: "busy",
    businessId: store.business.id,
    customerId: store.customers[0].id,
    customerName: "Teste",
    customerPhone: "11987654321",
    serviceIds: [combo.id],
    professionalId: lucas.id,
    start: "2026-10-05T12:00:00Z",
    end: "2026-10-05T13:00:00Z",
    price: combo.price,
    status: "confirmed",
    reminder: false,
    createdAt: "2026-10-01T12:00:00Z",
  });
  const next = nextFreeByProfessional(store, [combo.id], monday);
  assert.equal(next[lucas.id]?.time, "10:00");
  assert.equal(next[store.professionals[1].id]?.time, "09:00");
  // Ana Clara não faz corte + barba no seed.
  assert.equal(next[store.professionals[3].id], undefined);
});
