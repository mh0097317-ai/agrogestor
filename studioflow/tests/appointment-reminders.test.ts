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
  assert.ok(text.includes(store.services[0].name));
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
  for (const [step, label] of [
    [720, "12 horas"],
    [120, "2 horas"],
    [60, "1 hora"],
  ] as const) {
    const text = customerReminder(store, appointment, step);
    assert.ok(text.includes(label));
    assert.ok(text.includes("15/10"));
    assert.ok(text.includes("09:00"));
  }
});
