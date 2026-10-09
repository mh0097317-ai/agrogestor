import test from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { createSeed } from "../src/lib/seed";
import {
  runAssistant,
  runTool,
  type AssistantContext,
} from "../src/services/assistant/agent";
import {
  canUnderstand,
  understandMessage,
  nameAnswer,
  type Interpretation,
} from "../src/services/assistant/understanding";
import type { Appointment } from "../src/types";
import { unverifiedAvailabilityClaim } from "../src/services/assistant/reply-validation";

const store = createSeed();
const choice: Interpretation = {
  intent: "BOOK",
  stage: "CONFIRMING",
  confidence: 0.98,
  serviceIds: [store.services[0].id],
  professionalId: store.professionals[0].id,
  date: "2026-10-10",
  time: "10:00",
  missing: [],
  nextAction: "CONFIRM",
};
const input = {
  servicos: choice.serviceIds,
  profissional: choice.professionalId,
  inicio: "2026-10-10T10:00:00-03:00",
  nome: "Cliente Teste",
  telefone: "11987654321",
};
const appointment = {
  id: "test-booking",
  serviceIds: choice.serviceIds,
  start: input.inicio,
  status: "confirmed",
  customerName: input.nome,
} as Appointment;

test("availability claims require a real lookup, and names require a current question", () => {
  assert.equal(
    unverifiedAvailabilityClaim("Tenho horários livres hoje à noite!", false),
    true,
  );
  assert.equal(
    unverifiedAvailabilityClaim("Tenho horários livres hoje à noite!", true),
    false,
  );
  assert.equal(
    unverifiedAvailabilityClaim("Você prefere vir de manhã ou à tarde?", false),
    false,
  );
  const question = {
    id: "q",
    role: "assistant" as const,
    body: "Qual nome você prefere para o agendamento?",
    createdAt: "2026-10-09T12:00:00Z",
  };
  assert.equal(nameAnswer("Cliente Teste", [question]), "Cliente Teste");
  assert.equal(nameAnswer("Pode ser", [question]), "");
  assert.equal(
    nameAnswer("Cliente Teste", [
      { ...question, body: "Já registrei seu nome." },
    ]),
    "",
  );
});

test("a supplied name completes explicit current consent, never a refusal, question or stale choice", async () => {
  for (const [body, createdAt, expected] of [
    ["Pode marcar às 10h", "2026-10-09T12:00:00Z", "CONFIRM"],
    ["Não pode marcar às 10h", "2026-10-09T12:00:00Z", "ASK"],
    ["Pode marcar às 10h?", "2026-10-09T12:00:00Z", "ASK"],
    ["Pode marcar às 10h", "2026-10-09T10:00:00Z", "ASK"],
  ]) {
    const recent = [
      { id: "c", role: "customer" as const, body, createdAt },
      {
        id: "q",
        role: "assistant" as const,
        body: "Qual nome você prefere para o agendamento?",
        createdAt: "2026-10-09T12:00:30Z",
      },
    ];
    const actual = await understandMessage(
      async () =>
        result([
          {
            type: "tool_use",
            id: "interpret",
            name: "interpretar_pedido",
            input: {
              ...choice,
              missing: ["name", "confirmation"],
              nextAction: "ASK",
            },
          },
        ]),
      "Cliente Teste",
      store,
      recent,
      "2026-10-09T12:01:00Z",
    );
    assert.equal(actual.interpretation.nextAction, expected, body);
    assert.equal(actual.interpretation.missing.includes("name"), false);
  }
});
const result = (
  content: Exclude<Anthropic.Beta.BetaMessageParam["content"], string>,
  stop_reason = "end_turn",
) =>
  ({
    content,
    stop_reason,
    usage: { input_tokens: 10, output_tokens: 10 },
  }) as Anthropic.Beta.BetaMessage;

test("a complete confirmed choice executes booking once instead of asking again", async () => {
  let bookings = 0,
    calls = 0;
  const turn = await runAssistant({
    store,
    history: [],
    customerText: "Pode marcar às 10h",
    interpretation: choice,
    ctx: {
      channel: "whatsapp",
      origin: "https://test",
      payments: false,
      verifiedPhone: "11987654321",
      loadStore: async () => store,
      book: async (request) => {
        bookings++;
        assert.equal(request.start, input.inicio);
        return appointment;
      },
    },
    create: async (params) => {
      calls++;
      if (calls === 1) {
        assert.deepEqual(params.tool_choice, {
          type: "tool",
          name: "agendar",
          disable_parallel_tool_use: true,
        });
        return result(
          [{ type: "tool_use", id: "book", name: "agendar", input }],
          "tool_use",
        );
      }
      return result([{ type: "text", text: "Prontinho!" }]);
    },
  });
  assert.equal(bookings, 1);
  assert.equal(turn.booked?.id, appointment.id);
  assert.match(turn.reply, /confirmado/);
  assert.match(turn.reply, new RegExp(store.services[0].name));
});

test("missing consent, name, date or low confidence never exposes the booking tool", async () => {
  for (const interpretation of [
    { ...choice, missing: ["confirmation"] as Interpretation["missing"] },
    { ...choice, missing: ["name"] as Interpretation["missing"] },
    { ...choice, date: "" },
    { ...choice, confidence: 0.4 },
    { ...choice, nextAction: "CONSULT" as const },
  ]) {
    await runAssistant({
      store,
      history: [],
      customerText: "Tem às 10h?",
      interpretation,
      ctx: {
        channel: "whatsapp",
        origin: "https://test",
        payments: false,
        loadStore: async () => store,
        book: async () => {
          throw Error("unauthorized booking");
        },
      },
      create: async (params) => {
        assert.equal(
          params.tools?.some(
            (tool) => "name" in tool && tool.name === "agendar",
          ),
          false,
        );
        return result([
          { type: "text", text: "Você prefere esse horário para o corte?" },
        ]);
      },
    });
  }
});

test("booking cannot switch the selected service, time or professional; retries are idempotent", async () => {
  let bookings = 0;
  const ctx: AssistantContext = {
    channel: "whatsapp",
    origin: "https://test",
    payments: false,
    verifiedPhone: "11987654321",
    bookingAllowed: true,
    bookingSelection: choice,
    loadStore: async () => store,
    book: async () => {
      bookings++;
      return appointment;
    },
  };
  for (const changed of [
    { ...input, inicio: "2026-10-10T11:00:00-03:00" },
    { ...input, servicos: [store.services[1].id] },
    { ...input, profissional: store.professionals[1].id },
  ])
    assert.equal((await runTool("agendar", changed, ctx, {})).isError, true);
  assert.equal(bookings, 0);
  const state = {};
  await runTool("agendar", input, ctx, state);
  await runTool("agendar", input, ctx, state);
  assert.equal(bookings, 1);
});

test("natural name questions and colloquial acceptance continue only a recent business conversation", () => {
  const recent = [
    {
      id: "1",
      role: "assistant" as const,
      body: "O corte fica às 10h amanhã. Como prefere ser chamado?",
      createdAt: "2026-10-09T12:00:00Z",
    },
  ];
  for (const text of [
    "Cliente Teste",
    "Pode sim",
    "Fechado",
    "Esse mesmo",
    "Pode marcar às 09:00",
    "Prefiro às 10h",
  ]) {
    assert.equal(
      canUnderstand(text, store, recent, "2026-10-09T12:01:00Z"),
      true,
      text,
    );
    assert.equal(
      canUnderstand(text, store, [], "2026-10-09T12:01:00Z"),
      false,
      text,
    );
  }
});
