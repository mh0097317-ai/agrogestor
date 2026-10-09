import test from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { createSeed } from "../src/lib/seed";
import { professionalStore } from "../src/services/assistant/agent";
import {
  canUnderstand,
  conversationContext,
  customerBookingContext,
  understandMessage,
} from "../src/services/assistant/understanding";

const store = createSeed();
const at = "2026-10-08T15:00:00Z";
const recent = [
  {
    id: "request",
    role: "customer" as const,
    body: "Quero cortar o cabelo",
    createdAt: "2026-10-08T14:59:00Z",
  },
];

test("vague availability continues the customer's own unfinished commercial request", () => {
  for (const text of [
    "Tem hoje?",
    "Consegue depois das 18?",
    "E amanhã?",
    "E mais tarde?",
    "Quanto fica?",
    "Cliente: tem\nCliente: pra hoje?",
  ])
    assert.equal(canUnderstand(text, store, recent, at), true, text);
  assert.equal(canUnderstand("Tem hoje?", store, [], at), false);
  assert.equal(
    canUnderstand("Tem hoje?", store, recent, "2026-10-08T18:00:00Z"),
    true,
  );
  assert.equal(
    canUnderstand("sim", store, recent, "2026-10-08T18:00:00Z"),
    false,
  );
  assert.equal(
    canUnderstand("Tem hoje?", store, recent, "2026-10-09T15:00:00Z"),
    false,
  );
  for (const text of [
    "o almoço está pronto",
    "tem pizza hoje?",
    "bom dia",
    "o jogo de ontem",
    "minha mãe pediu aquele mesmo",
  ])
    assert.equal(
      canUnderstand(text, store, recent, at, "completed booking"),
      false,
      text,
    );
});

test("explicit references retrieve at most six prior visible messages within 30 days, never future events", () => {
  const old = [
    { ...recent[0], id: "old", createdAt: "2026-10-06T15:00:00Z" },
    {
      ...recent[0],
      id: "event",
      role: "event" as const,
      body: "private diagnostic",
    },
    { ...recent[0], id: "future", createdAt: "2026-10-09T15:00:00Z" },
  ];
  assert.deepEqual(
    conversationContext(old, at, "quero aquele mesmo", store).map((m) => m.id),
    ["old"],
  );
  assert.equal(conversationContext(old, at, "18h", store).length, 0);
  assert.equal(
    conversationContext(old, "2026-12-08T15:00:00Z", "aquele mesmo", store)
      .length,
    0,
  );
});

test("intelligent booking lookup isolates sender, business and professional and omits historical prices", () => {
  const template = store.appointments[0];
  const own = {
    ...template,
    customerPhone: "62987654321",
    professionalId: store.professionals[0].id,
    start: "2026-10-07T15:00:00Z",
    end: "2026-10-07T15:40:00Z",
    status: "completed" as const,
    serviceIds: [store.services[0].id],
    price: 123456,
  };
  const catalog = {
    ...store,
    appointments: [
      own,
      { ...own, customerPhone: "62987654322", serviceIds: ["other-customer"] },
      { ...own, businessId: "foreign-tenant", serviceIds: ["other-tenant"] },
      {
        ...own,
        professionalId: store.professionals[1].id,
        serviceIds: ["other-barber"],
      },
      { ...own, status: "cancelled" as const, serviceIds: ["cancelled"] },
      { ...own, end: "2026-10-10T15:00:00Z", serviceIds: ["future"] },
    ],
  };
  const found = customerBookingContext(
    professionalStore(catalog, own.professionalId),
    "+55 62 98765-4321",
    own.professionalId,
    at,
  );
  assert.equal(found.split("\n").length, 1);
  assert.match(found, new RegExp(store.services[0].id));
  assert.doesNotMatch(
    found,
    /other-|foreign|cancelled|future|123456|customerPhone/,
  );
  assert.equal(customerBookingContext(catalog, undefined, undefined, at), "");
  assert.equal(canUnderstand("tem hoje?", catalog, [], at, found), true);
  assert.equal(
    canUnderstand("o almoço está pronto", catalog, [], at, found),
    false,
  );
});

test("historical reference is interpreted before replying and cannot authorize a new booking", async () => {
  let calls = 0;
  const result = await understandMessage(
    async (params) => {
      calls++;
      assert.match(JSON.stringify(params.messages), /completed-reference/);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              intent: "BOOK",
              stage: "CONFIRMING",
              confidence: 0.98,
              serviceIds: [store.services[0].id],
              professionalId: "",
              date: "",
              time: "",
              missing: [],
              nextAction: "CONFIRM",
            }),
          },
        ],
        usage: { input_tokens: 12, output_tokens: 20 },
      } as Anthropic.Beta.BetaMessage;
    },
    "quero aquele mesmo",
    store,
    [],
    at,
    "completed-reference",
  );
  assert.equal(calls, 1);
  assert.equal(result.interpretation.nextAction, "ASK");
  assert.deepEqual(result.interpretation.missing, ["confirmation"]);
});
