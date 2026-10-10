import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { resolveBookingDate } from "../src/services/assistant/booking-date";
import { availabilityReply } from "../src/services/assistant/availability-reply";
import type { Interpretation } from "../src/services/assistant/understanding";
import { understandMessage } from "../src/services/assistant/understanding";
import type { CreateMessage } from "../src/services/assistant/agent";
test("relative dates resolve in Sao Paulo and invalid/ambiguous dates remain unselected", () => {
  const at = "2026-10-10T01:00:00Z";
  assert.equal(resolveBookingDate("amanhã", at), "2026-10-10");
  assert.equal(resolveBookingDate("hoje", at), "2026-10-09");
  assert.equal(resolveBookingDate("sábado", at), "2026-10-10");
  assert.equal(resolveBookingDate("2026-02-30", at), "");
  assert.equal(resolveBookingDate("algum dia", at), "");
});

test("a provider BOOK/ASK with no missing field cannot stall an explicit current time choice", async () => {
  const store = createSeed();
  const service = store.services.find((s) => s.active)!;
  const selection: Interpretation = {
    intent: "BOOK",
    stage: "CONFIRMING",
    confidence: 0.95,
    serviceIds: [service.id],
    professionalId: service.professionalIds[0],
    date: "2026-10-12",
    time: "12:00",
    missing: [],
    nextAction: "ASK",
  };
  const create: CreateMessage = async () =>
    ({
      id: "test",
      type: "message",
      role: "assistant",
      model: "test",
      content: [{ type: "text", text: JSON.stringify(selection) }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }) as Awaited<ReturnType<CreateMessage>>;
  const recent = [
    {
      id: "a",
      role: "assistant" as const,
      body: "Tenho corte em 12/10/2026 às 12:00. Qual horário prefere?",
      createdAt: "2026-10-09T12:00:00Z",
    },
  ];
  const result = await understandMessage(
    create,
    "Pode marcar às 12:00",
    store,
    recent,
    "2026-10-09T12:01:00Z",
    "",
    "Cliente Teste",
  );
  assert.equal(result.interpretation.nextAction, "CONFIRM");
  const uncertain = await understandMessage(
    create,
    "Pode marcar às 12:00?",
    store,
    recent,
    "2026-10-09T12:01:00Z",
    "",
    "Cliente Teste",
  );
  assert.notEqual(uncertain.interpretation.nextAction, "CONFIRM");
});
test("afternoon requests offer only verified afternoon slots, at most three", () => {
  const store = createSeed();
  const service = store.services.find((s) => s.active)!;
  const pro = store.professionals.find(
    (p) => p.active && service.professionalIds.includes(p.id),
  )!;
  store.settings.openDays = [0, 1, 2, 3, 4, 5, 6];
  store.settings.openStart = "09:00";
  store.settings.openEnd = "19:00";
  pro.days = [0, 1, 2, 3, 4, 5, 6];
  pro.start = "09:00";
  pro.end = "19:00";
  const selection: Interpretation = {
    intent: "AVAILABILITY",
    stage: "CHOOSING_TIME",
    confidence: 0.95,
    serviceIds: [service.id],
    professionalId: pro.id,
    date: "amanhã",
    time: "",
    missing: [],
    nextAction: "CONSULT",
  };
  const reply = availabilityReply(
    selection,
    store,
    "amanhã à tarde",
    [],
    new Date("2026-10-09T12:00:00Z"),
  );
  assert.ok(reply);
  assert.match(reply, /10\/10\/2026/);
  const times = [...reply.matchAll(/às (\d{2}):\d{2}/g)].map((m) =>
    Number(m[1]),
  );
  assert.ok(times.length > 0 && times.length <= 3);
  assert.ok(times.every((h) => h >= 12 && h < 18));
  assert.doesNotMatch(reply, /09:00|confirmado/);
  const otherDays = availabilityReply(
    { ...selection, date: "2026-10-10" },
    store,
    "outros dias",
    [],
    new Date("2026-10-09T12:00:00Z"),
  );
  assert.ok(otherDays);
  assert.doesNotMatch(otherDays, /10\/10\/2026/);
  assert.equal(
    availabilityReply(
      { ...selection, serviceIds: ["foreign"] },
      store,
      "tarde",
    ),
    null,
  );
});
