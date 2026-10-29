import test from "node:test";
import assert from "node:assert/strict";
import { conversationalReply } from "../src/services/assistant/conversation-tone";
import { generalReply } from "../src/services/assistant/general-reply";
import { createSeed } from "../src/lib/seed";
import type { ConversationMessage } from "../src/types";
import type { CreateMessage } from "../src/services/assistant/agent";
import { understandMessage } from "../src/services/assistant/understanding";

const facts =
  "Corte fica R$ 30,00.\n\nMatheus — 18/10/2026, às 09:00 ou 10:00\n\nQual desses horários fica melhor para você?";
const lead = "Vamos pensar num visual para essa ocasião.";
const noProvider: CreateMessage = async () => {
  throw Error("Simple social replies must be immediate");
};

test("contextual acknowledgement preserves every verified fact and avoids repeated filler", () => {
  const reply = conversationalReply(facts, lead, []);
  assert.equal(reply, `${lead}\n\n${facts}`);
  const recent = [{ role: "assistant", body: reply }] as ConversationMessage[];
  assert.equal(conversationalReply(facts, lead, recent), facts);
  assert.equal(conversationalReply(facts, undefined, []), facts);
});

test("model acknowledgement cannot introduce a booking, offer, price, payment or link", () => {
  for (const unsafe of [
    "Seu horário está confirmado.",
    "Reservei para você.",
    "Temos vagas.",
    "O valor é trinta reais.",
    "Inclui lavagem grátis.",
    "Pague no Pix.",
    "Às 09:00.",
    "Visite https://exemplo.com",
    "Tudo bem?",
    "Boa noite!",
  ]) {
    assert.equal(conversationalReply(facts, unsafe, []), facts, unsafe);
  }
});

test("greeting and social follow-up continue a conversation without paid calls or a new introduction", async () => {
  const store = createSeed();
  const hello = await generalReply(noProvider, "Boa noite!", store, []);
  assert.match(hello.reply, /^Boa noite! Tudo bem\?/);
  const recent = [
    {
      role: "assistant",
      body: hello.reply,
      createdAt: new Date().toISOString(),
    },
  ] as ConversationMessage[];
  const answer = await generalReply(noProvider, "Tudo bem", store, recent);
  assert.match(answer.reply, /^Que bom!/);
  assert.doesNotMatch(answer.reply, /Tudo bem\?|Como posso/);
  recent.push({
    role: "assistant",
    body: facts,
    createdAt: new Date().toISOString(),
  } as ConversationMessage);
  const politeness = await generalReply(
    noProvider,
    "Tudo bem, e você?",
    store,
    recent,
  );
  assert.match(politeness.reply, /^Tudo certo por aqui!/);
  assert.match(politeness.reply, /Qual desses horários fica melhor/);
  assert.doesNotMatch(politeness.reply, /o que você gostaria de fazer hoje/);
  const well = await generalReply(noProvider, "Tudo bem", store, recent);
  assert.match(well.reply, /Qual desses horários fica melhor/);
  const stale = [
    { role: "assistant", body: facts, createdAt: "2026-01-01T12:00:00Z" },
  ] as ConversationMessage[];
  const freshHello = await generalReply(
    noProvider,
    "Boa noite",
    store,
    stale,
    new Date("2026-10-16T12:00:00Z"),
  );
  assert.doesNotMatch(freshHello.reply, /desses horários/);
});

test("context acknowledgement shares the interpretation call and never grants booking consent", async () => {
  const store = createSeed();
  const service = store.services.find((s) => s.active)!;
  let calls = 0;
  const create: CreateMessage = async () => {
    calls++;
    return {
      content: [
        {
          type: "tool_use",
          id: "interpret",
          name: "interpretar_pedido",
          input: {
            intent: "AVAILABILITY",
            stage: "QUALIFYING",
            confidence: 1,
            serviceIds: [service.id],
            professionalId: "",
            date: "",
            time: "",
            missing: ["date"],
            nextAction: "CONSULT",
            acknowledgement: lead,
          },
        },
      ],
      usage: { input_tokens: 50, output_tokens: 40 },
    } as Awaited<ReturnType<CreateMessage>>;
  };
  const result = await understandMessage(
    create,
    `Vou a um casamento e queria agendar ${service.name}`,
    store,
    [],
    "2026-10-16T12:00:00Z",
  );
  assert.equal(calls, 1);
  assert.equal(result.interpretation.acknowledgement, lead);
  assert.equal(result.interpretation.nextAction, "CONSULT");
  assert.equal(result.interpretation.time, "");
  assert.equal(result.usage.output, 40);
});
