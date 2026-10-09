import test from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { createSeed } from "../src/lib/seed";
import { matchesTimePeriod, requestedTimePeriod } from "../src/lib/time-period";
import { assistantImpact } from "../src/lib/assistant-impact";
import { nextFreeByProfessional } from "../src/lib/availability";
import {
  runAssistant,
  runTool,
  type AssistantContext,
  type CreateMessage,
} from "../src/services/assistant/agent";
import { unverifiedBookingClaim } from "../src/services/assistant/reply-validation";

test("períodos distinguem amanhã, preferências e limites de horários", () => {
  assert.equal(requestedTimePeriod("Quero amanhã"), "all");
  assert.equal(requestedTimePeriod("Prefiro à tarde"), "afternoon");
  assert.equal(
    requestedTimePeriod("Não quero de manhã, prefiro à tarde"),
    "afternoon",
  );
  assert.equal(requestedTimePeriod("De manhã ou à noite"), "all");
  assert.equal(matchesTimePeriod("11:30", "morning"), true);
  assert.equal(matchesTimePeriod("12:00", "morning"), false);
  assert.equal(matchesTimePeriod("12:00", "afternoon"), true);
  assert.equal(matchesTimePeriod("18:00", "afternoon"), false);
  assert.equal(matchesTimePeriod("18:00", "evening"), true);
  assert.equal(unverifiedBookingClaim("Seu horário está confirmado!"), true);
  assert.equal(unverifiedBookingClaim("Ainda não está confirmado."), false);
  assert.equal(unverifiedBookingClaim("Vou marcar. Qual é seu nome?"), false);
});

function context() {
  const store = createSeed();
  store.appointments = [];
  store.blockedTimes = [];
  store.settings.minNotice = 0;
  let writes = 0;
  const ctx: AssistantContext = {
    channel: "whatsapp",
    verifiedPhone: "11987654321",
    origin: "https://exemplo.app",
    payments: false,
    timePeriod: "afternoon",
    now: new Date("2026-10-05T10:00:00Z"),
    loadStore: async () => store,
    book: async () => {
      writes++;
      throw new Error("Unexpected booking");
    },
  };
  return { store, ctx, writes: () => writes };
}

test("busca de próximos horários filtra antes de escolher; modelo não substitui a tarde por manhã", async () => {
  const { store, ctx, writes } = context();
  const services = [store.services[0].id];
  const first = Object.values(
    nextFreeByProfessional(store, services, ctx.now, 14, (slot) =>
      matchesTimePeriod(slot.time, "afternoon"),
    ),
  );
  assert.ok(first.length > 0);
  assert.ok(first.every((slot) => matchesTimePeriod(slot.time, "afternoon")));
  const result = await runTool(
    "horarios_livres",
    {
      servicos: services,
      profissional: "any",
      data: "2026-10-05",
      periodo: "morning",
    },
    ctx,
    {},
  );
  const slots = JSON.parse(result.content);
  assert.ok(slots.length > 0);
  assert.ok(
    slots.every((slot: { hora: string }) =>
      matchesTimePeriod(slot.hora, "afternoon"),
    ),
  );
  const blocked = await runTool(
    "agendar",
    {
      servicos: services,
      inicio: "2026-10-05T09:00:00-03:00",
      nome: "Ana Paula",
      profissional: "any",
    },
    ctx,
    {},
  );
  assert.equal(blocked.isError, true);
  assert.equal(writes(), 0);
});

function answers(values: string[]) {
  const calls: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
  const create: CreateMessage = async (params) => {
    calls.push(params);
    return {
      content: [{ type: "text", text: values.shift(), citations: null }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 10 },
    } as unknown as Anthropic.Beta.BetaMessage;
  };
  return { create, calls };
}
test("resposta sem reserva salva é corrigida uma vez, sem executar outra ação", async () => {
  const { store, ctx, writes } = context();
  const model = answers([
    "Agendamento confirmado às 09:00!",
    "Vou consultar os horários da tarde. Qual dia você prefere?",
  ]);
  const result = await runAssistant({
    create: model.create,
    ctx,
    store,
    history: [],
    customerText: "Prefiro à tarde",
    now: ctx.now,
  });
  assert.equal(result.booked, undefined);
  assert.equal(writes(), 0);
  assert.equal(model.calls.length, 2);
  assert.equal(model.calls[1].tools, undefined);
  assert.match(result.reply, /Qual dia/);
});
test("segunda resposta inválida falha em vez de anunciar confirmação ou manhã", async () => {
  const { store, ctx, writes } = context();
  const model = answers([
    "Tenho 09:00. Pode ser?",
    "Seu horário está confirmado às 09:00!",
  ]);
  await assert.rejects(
    runAssistant({
      create: model.create,
      ctx,
      store,
      history: [],
      customerText: "Prefiro à tarde",
      now: ctx.now,
    }),
    /reply-validation-failed/,
  );
  assert.equal(writes(), 0);
  assert.equal(model.calls.length, 2);
});

test("resultados usam atribuição real, pagamentos parciais e datas de Brasília", () => {
  const store = createSeed();
  const base = store.appointments[0];
  store.appointments = [
    {
      ...base,
      id: "auto",
      businessId: store.business.id,
      bookingChannel: "assistant_whatsapp",
      status: "completed",
      createdAt: "2026-10-08T01:30:00Z",
      start: "2026-10-08T17:00:00Z",
      price: 100,
    },
    {
      ...base,
      id: "manual",
      businessId: store.business.id,
      bookingChannel: "manual",
      status: "completed",
    },
    {
      ...base,
      id: "cancelled",
      businessId: store.business.id,
      bookingChannel: "assistant_whatsapp",
      status: "cancelled",
    },
    {
      ...base,
      id: "other",
      businessId: "another-shop",
      bookingChannel: "assistant_whatsapp",
      status: "completed",
    },
  ];
  const payment = {
    id: "paid",
    businessId: store.business.id,
    appointmentId: "auto",
    amount: 20,
    method: "pix" as const,
    createdAt: "2026-10-08T18:00:00Z",
  };
  store.payments = [
    payment,
    { ...payment },
    { ...payment, id: "manual-pay", appointmentId: "manual", amount: 300 },
    { ...payment, id: "outside", createdAt: "2026-10-09T04:00:00Z" },
    { ...payment, id: "foreign", businessId: "another-shop", amount: 999 },
  ];
  assert.deepEqual(assistantImpact(store, "2026-10-08", "2026-10-08"), {
    created: 0,
    completed: 1,
    received: 20,
  });
  assert.deepEqual(assistantImpact(store, "2026-10-07", "2026-10-08"), {
    created: 1,
    completed: 1,
    received: 20,
  });
});
