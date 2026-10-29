import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { generalReply } from "../src/services/assistant/general-reply";
import {
  understandMessage,
  generalSelection,
} from "../src/services/assistant/understanding";
import { completeBookingSelection } from "../src/services/assistant/confirmed-booking";
import { needsBrazilianPortugueseReview } from "../src/services/assistant/agent";
import type { CreateMessage } from "../src/services/assistant/agent";

const store = createSeed();
const noModel: CreateMessage = async () => {
  throw Error("Must not call paid model");
};
const response = (text: string, input = 10, output = 5) =>
  ({
    content: [{ type: "text", text }],
    usage: { input_tokens: input, output_tokens: output },
  }) as Awaited<ReturnType<CreateMessage>>;

test("Brazilian Portuguese review catches missing accents and rough punctuation only", () => {
  assert.equal(
    needsBrazilianPortugueseReview(
      "Tudo certo! O corte custa R$ 30,00. Prefere hoje ou amanhã?",
    ),
    false,
  );
  assert.equal(needsBrazilianPortugueseReview("Voce tem horario disponivel?"), true);
  assert.equal(needsBrazilianPortugueseReview("Tudo bem ?"), true);
  assert.equal(needsBrazilianPortugueseReview("Tudo certo. temos horário."), true);
});

test("greetings, acknowledgments and unreadable media receive useful replies without model charges", async () => {
  for (const text of [
    "Bom dia!",
    "Boa tarde",
    "Boa noite",
    "Oi",
    "Obrigado",
    "Valeu!",
    "[O cliente enviou um áudio.]",
  ]) {
    const result = await generalReply(noModel, text, store, []);
    assert.ok(result.reply.length > 0, text);
    assert.deepEqual(result.usage, { input: 0, output: 0 });
    assert.equal(result.booked, undefined);
  }
});

test("arbitrary questions route to an answer without borrowing old consent, dates or customer records", async () => {
  const recent = [
    {
      id: "offer",
      role: "assistant" as const,
      body: "Tenho corte em 12/10/2026 às 09:00. Qual você prefere?",
      createdAt: "2026-10-10T12:00:00Z",
    },
  ];
  for (const text of [
    "Qual a capital da França?",
    "O que é juros compostos?",
    "Qual foi o resultado do futebol?",
    "O almoço está pronto",
    "Sim",
    "18h",
  ]) {
    const result = await understandMessage(
      noModel,
      text,
      store,
      [],
      "2026-10-10T12:00:01Z",
    );
    assert.equal(result.interpretation.intent, "GENERAL");
    assert.equal(result.interpretation.nextAction, "ANSWER");
    assert.deepEqual(result.interpretation.serviceIds, []);
    assert.equal(result.interpretation.date, "");
    assert.equal(completeBookingSelection(result.interpretation), false);
  }
  assert.equal(
    (await understandMessage(noModel, "O almoço está pronto", store, recent))
      .interpretation.intent,
    "GENERAL",
  );
});

test("even a stale interpreter OFF_TOPIC/SILENCE decision becomes a tool-free answer and clears mutation fields", async () => {
  for (const decision of [
    { intent: "OFF_TOPIC", nextAction: "SILENCE" },
    { intent: "INFORMATION", nextAction: "SILENCE" },
  ]) {
    const create: CreateMessage = async () =>
      response(
        JSON.stringify({
          ...generalSelection(),
          ...decision,
          serviceIds: [store.services[0].id],
          date: "2026-10-12",
          time: "09:00",
        }),
      );
    const result = await understandMessage(
      create,
      "Quero saber sobre cabelo",
      store,
      [],
    );
    assert.deepEqual(result.interpretation, generalSelection());
    assert.deepEqual(result.usage, { input: 10, output: 5 });
  }
});

test("general reply uses one call without tools, retains this chat only, handles unknown facts and counts actual tokens", async () => {
  let calls = 0;
  const create: CreateMessage = async (params) => {
    calls++;
    assert.equal(params.max_tokens, 400);
    assert.equal(params.tools, undefined);
    assert.equal(params.tool_choice, undefined);
    assert.match(String(params.system), /qualquer assunto/);
    assert.match(
      String(params.system),
      /não tem acesso à internet em tempo real/,
    );
    assert.doesNotMatch(
      String(params.system),
      /other-private-customer|private-cost/,
    );
    return {
      ...response("A capital da França é Paris."),
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 3,
        cache_creation_input_tokens: 2,
      },
    } as Awaited<ReturnType<CreateMessage>>;
  };
  const withPrivateData = {
    ...store,
    customers: [{ ...store.customers[0], name: "other-private-customer" }],
    products: [
      {
        id: "secret",
        businessId: "other",
        name: "private-cost",
        stock: 1,
        showPublic: true,
        active: true,
        price: 900,
      } as NonNullable<typeof store.products>[number],
    ],
  };
  const result = await generalReply(
    create,
    "Qual a capital da França?",
    withPrivateData,
    [],
  );
  assert.equal(calls, 1);
  assert.equal(result.reply, "A capital da França é Paris.");
  assert.deepEqual(result.usage, { input: 15, output: 5 });
  assert.equal(result.booked, undefined);
});

test("empty model answers ask for clarification, and unverified booking/availability claims never reach the customer", async () => {
  for (const text of [
    "",
    "Pronto, agendamento confirmado!",
    "Tenho horários livres amanhã.",
  ]) {
    const result = await generalReply(
      async () => response(text),
      "Pode me ajudar?",
      store,
      [],
    );
    assert.ok(result.reply);
    assert.doesNotMatch(
      result.reply,
      /agendamento confirmado|Tenho horários livres/,
    );
    assert.equal(result.booked, undefined);
  }
  const empty = await understandMessage(noModel, "   ", store, []);
  assert.equal(empty.interpretation.nextAction, "SILENCE");
});
