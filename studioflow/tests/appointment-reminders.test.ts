import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { customerReminder } from "../src/services/whatsapp/reminders";
test("customer reminder uses actual appointment data and Sao Paulo time", () => {
  const store = createSeed();
  const appointment = {
    ...store.appointments[0],
    customerName: "Ana Maria",
    start: "2026-10-07T19:00:00Z",
    serviceIds: [store.services[0].id],
  };
  const text = customerReminder(store, appointment);
  assert.ok(text.includes("Ana"));
  assert.ok(text.includes("16:00"));
  assert.ok(text.includes(store.business.name));
  assert.ok(text.toLowerCase().includes(store.services[0].name.toLowerCase()));
  assert.ok(
    text.includes(
      store.professionals.find((p) => p.id === appointment.professionalId)!
        .name,
    ),
  );
  assert.ok(!text.includes("Ana Maria"));
});

test("reminder steps explain their own lead time and show the real date", () => {
  const store = createSeed(),
    appointment = {
      ...store.appointments[0],
      start: "2026-10-15T12:00:00Z",
      customerName: "Ana",
    };
  const texts = ([720, 120, 60] as const).map((step) =>
    customerReminder(store, appointment, step),
  );
  assert.match(texts[0], /lembrar/);
  assert.match(texts[1], /2 horas/);
  assert.match(texts[2], /1 hora/);
  for (const text of texts) {
    assert.ok(text.includes("15/10"));
    assert.ok(text.includes("09:00"));
  }
  assert.equal(new Set(texts).size, 3, "three different notes");
});

test("reminders say hoje and amanhã when they are", () => {
  const store = createSeed();
  const appointment = {
    ...store.appointments[0],
    start: "2026-10-15T19:00:00Z",
    customerName: "Ana",
  };
  const eve = new Date("2026-10-14T22:00:00Z");
  assert.match(customerReminder(store, appointment, 720, eve), /amanhã, 15\/10/);
  const day = new Date("2026-10-15T17:00:00Z");
  assert.match(customerReminder(store, appointment, 120, day), /hoje, 15\/10/);
});
