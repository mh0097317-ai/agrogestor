import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { availableSlots } from "../src/lib/availability";
import { availabilityReply } from "../src/services/assistant/availability-reply";
import {
  exactPriceSelection,
  routineReply,
} from "../src/services/assistant/routine-reply";
import {
  understandMessage,
  type Interpretation,
} from "../src/services/assistant/understanding";
import type { CreateMessage } from "../src/services/assistant/agent";

function fixture() {
  const store = createSeed();
  const service = store.services.find((s) => s.active)!;
  const professional = store.professionals.find(
    (p) => p.active && service.professionalIds.includes(p.id),
  )!;
  store.appointments = [];
  store.settings.openDays = [1, 2, 3, 4, 5];
  store.settings.openStart = "09:00";
  store.settings.openEnd = "19:00";
  professional.days = [1, 2, 3, 4, 5];
  professional.start = "09:00";
  professional.end = "19:00";
  const now = new Date("2026-10-10T12:00:00Z"); // Saturday, no availability.
  const selection: Interpretation = {
    intent: "BOOK",
    stage: "QUALIFYING",
    confidence: 0.95,
    serviceIds: [service.id],
    professionalId: professional.id,
    date: "",
    time: "",
    missing: ["date", "time", "name"],
    nextAction: "ASK",
  };
  return { store, service, professional, now, selection };
}

test("initial interest cannot become an invented date/time even if the interpreter supplies them", async () => {
  const { store, selection, now } = fixture();
  const create: CreateMessage = async () =>
    ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ...selection,
            date: "2026-10-10",
            time: "14:00",
            missing: ["confirmation"],
            nextAction: "CONFIRM",
          }),
        },
      ],
      usage: { input_tokens: 1, output_tokens: 1 },
    }) as Awaited<ReturnType<CreateMessage>>;
  const result = await understandMessage(
    create,
    "quero cortar o cabelo à tarde",
    store,
    [],
    now.toISOString(),
  );
  assert.equal(result.interpretation.date, "");
  assert.equal(result.interpretation.time, "");
  assert.equal(result.interpretation.nextAction, "CONSULT");
  const explicit = await understandMessage(
    create,
    "quero corte hoje às 14h",
    store,
    [],
    now.toISOString(),
  );
  assert.equal(explicit.interpretation.date, "2026-10-10");
  assert.equal(explicit.interpretation.time, "14:00");
});

test("a service request without a date proposes fresh next slots without booking or selecting for the customer", () => {
  const { store, selection, now } = fixture();
  const original = JSON.stringify(store),
    originalSelection = JSON.stringify(selection);
  const reply = availabilityReply(
    selection,
    store,
    "quero cortar o cabelo à tarde",
    [],
    now,
  )!;
  assert.match(reply, /12\/10\/2026/);
  assert.doesNotMatch(reply, /10\/10\/2026|Qual dia|confirmado|reservado/);
  assert.equal((reply.match(/12\/10\/2026/g) || []).length, 1);
  const offers = [...reply.matchAll(/\b(\d{2}:\d{2})\b/g)];
  assert.ok(offers.length > 0 && offers.length <= 3);
  for (const offer of offers) {
    assert.ok(
      Number(offer[1].slice(0, 2)) >= 12 && Number(offer[1].slice(0, 2)) < 18,
    );
    assert.ok(
      availableSlots(
        store,
        selection.serviceIds,
        selection.professionalId,
        "2026-10-12",
        now,
      ).some((s) => s.time === offer[1]),
    );
  }
  assert.equal(JSON.stringify(store), original);
  assert.equal(JSON.stringify(selection), originalSelection);
  const exactTime = availabilityReply(
    selection,
    store,
    "quero corte às 14h",
    [],
    now,
  )!;
  assert.match(exactTime, /às 14:00/);
  assert.doesNotMatch(exactTime, /às 12:|às 09:/);
});

test("availability offers every eligible barber in chronological order", () => {
  const { store, service, now } = fixture();
  const people = store.professionals.filter(
    (person) => person.active && service.professionalIds.includes(person.id),
  );
  service.professionalIds = people.map((person) => person.id);
  for (const person of people) {
    person.days = [1, 2, 3, 4, 5];
    person.start = "09:00";
    person.end = "19:00";
  }
  const reply = availabilityReply(
    {
      intent: "AVAILABILITY",
      stage: "CHOOSING_TIME",
      confidence: 1,
      serviceIds: [service.id],
      professionalId: "any",
      date: "2026-10-12",
      time: "",
      missing: ["time"],
      nextAction: "CONSULT",
    },
    store,
    "quais horários tem segunda de manhã?",
    [],
    now,
  )!;
  const offers = reply.split("\n\n").filter((part) => part.includes(" — "));
  for (const offer of offers) {
    const times = [...offer.matchAll(/\b(\d{2}:\d{2})\b/g)].map((match) => match[1]);
    assert.deepEqual(times, [...times].sort());
  }
  assert.match(reply, /Com quem você prefere marcar\?/);
  for (const person of people.slice(0, 3)) assert.match(reply, new RegExp(person.name, "i"));
});

test("the interpreter cannot silently narrow the customer's options to one barber", async () => {
  const { store, service, professional, now, selection } = fixture();
  const create: CreateMessage = async () =>
    ({
      content: [
        {
          type: "tool_use",
          name: "interpretar_pedido",
          input: {
            ...selection,
            serviceIds: [service.id],
            professionalId: professional.id,
            date: "2026-10-12",
            missing: ["time"],
            nextAction: "CONSULT",
          },
        },
      ],
      usage: { input_tokens: 1, output_tokens: 1 },
    }) as Awaited<ReturnType<CreateMessage>>;
  const general = await understandMessage(
    create,
    "quero um corte na segunda",
    store,
    [],
    now.toISOString(),
  );
  assert.equal(general.interpretation.professionalId, "");
  const requested = await understandMessage(
    create,
    `quero um corte com ${professional.name} na segunda`,
    store,
    [],
    now.toISOString(),
  );
  assert.equal(requested.interpretation.professionalId, professional.id);
});

test("price answers propose real slots once, without an additional model request", () => {
  const { store, service, professional, now } = fixture();
  const selection = exactPriceSelection(
    `Quanto custa ${service.name}?`,
    store,
  )!;
  selection.professionalId = professional.id;
  const reply = routineReply(selection, store, { now })!;
  assert.match(reply, /12\/10\/2026/);
  assert.ok(
    reply.toLowerCase().startsWith(`${service.name.toLowerCase()} fica`),
  );
  assert.equal((reply.match(/\?/g) || []).length, 1);
  const repeated = routineReply(selection, store, {
    now,
    recent: [
      {
        id: "previous",
        role: "assistant",
        body: reply,
        createdAt: now.toISOString(),
      },
    ],
  })!;
  assert.ok(
    repeated.toLowerCase().startsWith(`${service.name.toLowerCase()} fica`),
  );
  assert.doesNotMatch(repeated, /Tenho|prefere|\?/);
  const keepingDate = routineReply(selection, store, {
    now,
    recent: [
      {
        id: "date-choice",
        role: "customer",
        body: "quero na sexta-feira",
        createdAt: now.toISOString(),
      },
    ],
  })!;
  assert.doesNotMatch(keepingDate, /Tenho|12\/10\/2026|\?/);
});

test("initiative keeps chosen dates, refuses invalid data and does not reopen declined or human conversations", () => {
  const { store, selection, now } = fixture();
  const onClosedDay = availabilityReply(
    { ...selection, date: "2026-10-11", nextAction: "CONSULT" },
    store,
    "domingo",
    [],
    now,
  )!;
  assert.match(onClosedDay, /Não encontrei/);
  assert.doesNotMatch(onClosedDay, /12\/10\/2026/);
  const invalid = availabilityReply(
    { ...selection, date: "2026-02-30", nextAction: "CONSULT" },
    store,
    "dia 30",
    [],
    now,
  )!;
  assert.match(invalid, /Qual dia/);
  assert.equal(
    availabilityReply(
      { ...selection, intent: "OFF_TOPIC", nextAction: "SILENCE" },
      store,
      "não quero, obrigado",
      [],
      now,
    ),
    null,
  );
  assert.equal(
    availabilityReply(
      { ...selection, intent: "SUPPORT", nextAction: "HANDOFF" },
      store,
      "quero falar com uma pessoa",
      [],
      now,
    ),
    null,
  );
  assert.equal(
    availabilityReply(
      { ...selection, professionalId: "foreign" },
      store,
      "qualquer dia",
      [],
      now,
    ),
    null,
  );
  assert.equal(
    availabilityReply(
      { ...selection, serviceIds: [] },
      store,
      "quero agendar",
      [],
      now,
    ),
    null,
  );
  store.settings.openDays = [];
  assert.match(
    availabilityReply(selection, store, "à tarde", [], now)!,
    /Não encontrei/,
  );
});
