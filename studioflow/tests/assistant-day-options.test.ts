import test from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { createSeed } from "../src/lib/seed";
import { availableSlots } from "../src/lib/availability";
import {
  canUnderstand,
  type Interpretation,
} from "../src/services/assistant/understanding";
import {
  runAssistant,
  runTool,
  type AssistantContext,
  type CreateMessage,
} from "../src/services/assistant/agent";
import type { ConversationMessage } from "../src/types";

function fixture() {
  const store = createSeed();
  store.appointments = [];
  store.blockedTimes = [];
  store.settings.minNotice = 0;
  const professional = store.professionals[0];
  professional.days = [1, 2, 3, 4, 5, 6];
  store.settings.openDays = [1, 2, 3, 4, 5, 6];
  const now = new Date("2026-10-09T10:00:00Z");
  const ctx: AssistantContext = {
    channel: "whatsapp",
    professionalId: professional.id,
    origin: "https://test.app",
    payments: false,
    now,
    loadStore: async () => store,
    book: async () => {
      throw new Error("Must not book while consulting days");
    },
  };
  return { store, ctx, now, professional };
}

test("other days continues a recent commercial conversation, never a personal chat", () => {
  const { store } = fixture();
  const recent: ConversationMessage[] = [
    {
      id: "1",
      role: "customer",
      body: "O corte é quanto?",
      createdAt: "2026-10-08T22:03:00Z",
    },
    {
      id: "2",
      role: "assistant",
      body: "Tenho horários no sábado às 09:00 e 14:00.",
      createdAt: "2026-10-08T22:04:00Z",
    },
  ];
  for (const text of [
    "Quais são os outros dias ?",
    "Quais dias disponíveis?",
    "Tem outras datas?",
    "E nos outros dias?",
  ]) {
    assert.equal(
      canUnderstand(text, store, recent, "2026-10-08T22:05:00Z"),
      true,
      text,
    );
    assert.equal(
      canUnderstand(text, store, [], "2026-10-08T22:05:00Z"),
      false,
      text,
    );
    assert.equal(
      canUnderstand(text, store, recent, "2026-10-10T22:05:00Z"),
      false,
      text,
    );
  }
  assert.equal(canUnderstand("Minha mãe pediu carvão", store, recent), false);
});

test("day options skip the previous date, closed days and respect the connected professional and period", async () => {
  const { store, ctx, professional, now } = fixture();
  const services = [store.services[0].id];
  const result = await runTool(
    "dias_disponiveis",
    {
      servicos: services,
      profissional: store.professionals[1].id,
      periodo: "morning",
      excluir_data: "2026-10-10",
    },
    { ...ctx, timePeriod: "afternoon" },
    {},
  );
  assert.equal(result.isError, undefined);
  const data = JSON.parse(result.content) as {
    dias: {
      data: string;
      horarios: { hora: string; inicio: string; profissional_id: string }[];
    }[];
  };
  assert.equal(data.dias.length, 3);
  assert.deepEqual(
    data.dias.map((d) => d.data),
    ["2026-10-09", "2026-10-12", "2026-10-13"],
  );
  for (const day of data.dias) {
    const real = availableSlots(
      store,
      services,
      professional.id,
      day.data,
      now,
    );
    assert.ok(day.horarios.length <= 3);
    for (const slot of day.horarios) {
      assert.equal(slot.profissional_id, professional.id);
      assert.ok(slot.hora >= "12:00" && slot.hora < "18:00");
      assert.ok(real.some((actual) => actual.start === slot.inicio));
    }
  }
  store.blockedTimes = [
    {
      id: "closed-monday",
      businessId: store.business.id,
      professionalId: professional.id,
      start: "2026-10-12T00:00:00-03:00",
      end: "2026-10-13T00:00:00-03:00",
      reason: "Unavailable",
    },
  ];
  const blocked = await runTool(
    "dias_disponiveis",
    {
      servicos: services,
      profissional: "any",
      periodo: "all",
      excluir_data: "2026-10-10",
    },
    ctx,
    {},
  );
  assert.deepEqual(
    JSON.parse(blocked.content).dias.map((d: { data: string }) => d.data),
    ["2026-10-09", "2026-10-13", "2026-10-14"],
  );
  store.settings.maxDays = 0;
  const empty = await runTool(
    "dias_disponiveis",
    {
      servicos: services,
      profissional: "any",
      periodo: "all",
      excluir_data: "2026-10-09",
    },
    ctx,
    {},
  );
  assert.deepEqual(JSON.parse(empty.content).dias, []);
});

test("a request for day options consults instead of asking which day, without booking authorization", async () => {
  const { store, ctx, now, professional } = fixture();
  const calls: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
  const interpretation: Interpretation = {
    intent: "AVAILABILITY",
    stage: "QUALIFYING",
    confidence: 0.98,
    serviceIds: [store.services[0].id],
    professionalId: professional.id,
    date: "",
    time: "",
    missing: ["date"],
    nextAction: "ASK",
  };
  const create: CreateMessage = async (params) => {
    calls.push(structuredClone(params));
    return {
      content:
        calls.length === 1
          ? [
              {
                type: "tool_use",
                id: "days",
                name: "dias_disponiveis",
                input: {
                  servicos: interpretation.serviceIds,
                  profissional: professional.id,
                  periodo: "all",
                  excluir_data: "2026-10-10",
                },
              },
            ]
          : [
              {
                type: "text",
                text: "Além de sábado, tenho sexta, 09/10, às 09:00 e segunda, 12/10, às 09:00. Qual fica melhor?",
              },
            ],
      stop_reason: calls.length === 1 ? "tool_use" : "end_turn",
      usage: { input_tokens: 10, output_tokens: 10 },
    } as Anthropic.Beta.BetaMessage;
  };
  const result = await runAssistant({
    create,
    store,
    ctx,
    now,
    interpretation,
    history: [],
    customerText: "Quais são os outros dias?",
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].tool_choice, {
    type: "tool",
    name: "dias_disponiveis",
    disable_parallel_tool_use: true,
  });
  assert.equal(
    calls[0].tools?.some((t) => "name" in t && t.name === "agendar"),
    false,
  );
  const content = calls[1].messages.at(-1)?.content;
  assert.ok(Array.isArray(content) && content[0].type === "tool_result");
  assert.match(result.reply, /12\/10/);
  assert.equal(result.booked, undefined);
});

test("repeated price replies are revised once without tools or a repeated scheduling pitch", async () => {
  const { store, ctx, now } = fixture();
  const previous =
    "Boa noite! O corte fica R$ 30,00. Quer que eu veja um horário para você?";
  const calls: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
  const create: CreateMessage = async (params) => {
    calls.push(structuredClone(params));
    return {
      content: [
        {
          type: "text",
          text:
            calls.length === 1
              ? "O corte fica R$ 30,00. Quer que eu veja um horário para você?"
              : "Isso, o corte custa R$ 30,00.",
        },
      ],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 10 },
    } as Anthropic.Beta.BetaMessage;
  };
  const result = await runAssistant({
    create,
    store,
    ctx,
    now,
    history: [
      { role: "user", content: "Quanto custa o corte?" },
      { role: "assistant", content: previous },
    ],
    customerText: "O corte é quanto?",
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].tools, undefined);
  assert.equal(result.reply, "Isso, o corte custa R$ 30,00.");
});
