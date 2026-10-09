import test from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { createSeed } from "../src/lib/seed";
import {
  runAssistant,
  systemPrompt,
  type AssistantContext,
  type BookRequest,
  type CreateMessage,
} from "../src/services/assistant/agent";
import type { Appointment } from "../src/types";

type Block = Anthropic.Beta.BetaContentBlock;
const reply = (
  content: Block[],
  stop: Anthropic.Beta.BetaMessage["stop_reason"],
): Anthropic.Beta.BetaMessage =>
  ({
    id: "msg",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 20 },
  }) as unknown as Anthropic.Beta.BetaMessage;
const text = (value: string) =>
  ({ type: "text", text: value, citations: null }) as Block;
const call = (id: string, name: string, input: Record<string, unknown>) =>
  ({ type: "tool_use", id, name, input }) as Block;

/** Plays scripted model answers and records what it was sent. */
function scripted(
  steps: ((
    params: Anthropic.Beta.MessageCreateParamsNonStreaming,
  ) => Anthropic.Beta.BetaMessage)[],
) {
  const sent: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
  const create: CreateMessage = async (params) => {
    sent.push(structuredClone(params));
    const step = steps.shift();
    if (!step) throw new Error("unexpected call");
    return step(params);
  };
  return { create, sent };
}

test("recepcionista: consulta, marca com o WhatsApp verificado e só acrescenta histórico", async () => {
  const store = createSeed();
  store.settings.depositMode = "off";
  const service = store.services.find((item) => item.active)!;
  const booked: BookRequest[] = [];
  const ctx: AssistantContext = {
    channel: "whatsapp",
    verifiedPhone: "11987654321",
    origin: "https://exemplo.app",
    payments: false,
    loadStore: async () => store,
    book: async (input) => {
      booked.push(input);
      return {
        id: "a1",
        token: "t".repeat(64),
        start: input.start,
        price: service.price,
        status: "confirmed",
      } as Appointment;
    },
  };
  // Turn 1: the model looks up the next free times, then offers them.
  let offered = "";
  const first = scripted([
    () =>
      reply(
        [call("c1", "proximos_horarios", { servicos: [service.id] })],
        "tool_use",
      ),
    (params) => {
      const result = params.messages.at(-1)!
        .content as Anthropic.Beta.BetaToolResultBlockParam[];
      const slots = JSON.parse(String(result[0].content));
      offered = slots[0].inicio;
      assert.ok(slots[0].profissional_id);
      return reply([text(`Tenho ${slots[0].quando}. Pode ser?`)], "end_turn");
    },
  ]);
  const turn1 = await runAssistant({
    create: first.create,
    ctx,
    store,
    history: [],
    customerText: "Oi, quero cortar o cabelo",
  });
  assert.match(turn1.reply, /Pode ser\?/);
  assert.equal(first.sent[0].model, "claude-haiku-4-5");
  assert.equal(first.sent[0].max_tokens, 600);
  assert.equal(first.sent[0].fallbacks, undefined);
  assert.equal(first.sent[0].output_config, undefined);
  assert.ok(String(first.sent[0].system).includes(service.name));

  // Turn 2: the customer accepts; the phone comes from WhatsApp, not the model.
  const second = scripted([
    () =>
      reply(
        [
          call("c2", "agendar", {
            servicos: [service.id],
            profissional: "any",
            inicio: offered,
            nome: "Ana Paula Souza",
            telefone: "00000000000",
            cpf: "",
          }),
        ],
        "tool_use",
      ),
    (params) => {
      const result = params.messages.at(-1)!
        .content as Anthropic.Beta.BetaToolResultBlockParam[];
      assert.match(String(result[0].content), /booking\/t{64}/);
      return reply([text("Prontinho, marcado!")], "end_turn");
    },
  ]);
  const turn2 = await runAssistant({
    create: second.create,
    ctx,
    store,
    history: turn1.history,
    customerText: "Pode, sou a Ana Paula Souza",
  });
  assert.match(turn2.reply, /Agendamento confirmado/);
  assert.ok(turn2.reply.includes(`${ctx.origin}/booking/${"t".repeat(64)}`));
  assert.equal(booked[0].phone, "11987654321");
  assert.equal(booked[0].start, offered);
  assert.equal(turn2.booked?.id, "a1");
  // Append-only: the earlier conversation is an exact prefix.
  assert.deepEqual(
    second.sent[0].messages.slice(0, turn1.history.length),
    turn1.history,
  );
  assert.equal(turn2.usage.input, 200);
});

test("confirmação usa horário e estado salvos, inclusive sinal e aprovação pendentes", async () => {
  const store = createSeed();
  const service = store.services[0];
  for (const pending of ["none", "approval", "deposit"] as const) {
    const ctx: AssistantContext = {
      channel: "whatsapp",
      verifiedPhone: "11987654321",
      origin: "https://exemplo.app",
      payments: false,
      loadStore: async () => store,
      book: async (input) =>
        ({
          id: "saved",
          start: input.start,
          status: pending === "none" ? "confirmed" : "pending",
          token: "actual-receipt",
          depositStatus: pending === "deposit" ? "pending" : null,
          depositAmount: 20,
        }) as Appointment,
    };
    const model = scripted([
      () =>
        reply(
          [
            call("book", "agendar", {
              servicos: [service.id],
              inicio: "2026-10-09T18:00:00-03:00",
              nome: "Ana Paula",
              profissional: "any",
            }),
          ],
          "tool_use",
        ),
      () => reply([text("Tudo confirmado para 09:00!")], "end_turn"),
    ]);
    const result = await runAssistant({
      create: model.create,
      ctx,
      store,
      history: [],
      customerText: "Pode marcar, sou Ana Paula",
    });
    assert.match(result.reply, /18:00/);
    assert.doesNotMatch(result.reply, /09:00/);
    assert.match(result.reply, /booking\/actual-receipt/);
    if (pending === "deposit") {
      assert.match(result.reply, /aguardando o sinal/);
      assert.doesNotMatch(result.reply, /Agendamento confirmado/);
    } else if (pending === "approval")
      assert.match(result.reply, /aguardando confirmação/);
    else assert.match(result.reply, /Agendamento confirmado/);
    assert.equal(model.sent.length, 2);
  }
});

test("recepcionista: sinal pede CPF, humano assume e recusa vira atendimento humano", async () => {
  const store = createSeed();
  store.settings.depositMode = "fixed";
  store.settings.depositValue = 20;
  const service = store.services.find((item) => item.active)!;
  const ctx: AssistantContext = {
    channel: "web",
    origin: "https://exemplo.app",
    payments: true,
    loadStore: async () => store,
    book: async () => {
      throw new Error("should not book without CPF");
    },
  };
  assert.match(systemPrompt(store, true), /sinal de R\$\s?20,00/);
  const flow = scripted([
    () =>
      reply(
        [
          call("c1", "agendar", {
            servicos: [service.id],
            profissional: "any",
            inicio: new Date(Date.now() + 86400000).toISOString(),
            nome: "Ana Paula",
            telefone: "11987654321",
            cpf: "",
          }),
        ],
        "tool_use",
      ),
    (params) => {
      const result = params.messages.at(-1)!
        .content as Anthropic.Beta.BetaToolResultBlockParam[];
      assert.equal(result[0].is_error, true);
      assert.match(String(result[0].content), /CPF/);
      return reply(
        [call("c2", "chamar_humano", { motivo: "Cliente sem CPF" })],
        "tool_use",
      );
    },
    () => reply([text("Já chamei a equipe.")], "end_turn"),
  ]);
  const turn = await runAssistant({
    create: flow.create,
    ctx,
    store,
    history: [],
    customerText: "Quero marcar amanhã",
  });
  assert.equal(turn.handoff, "Cliente sem CPF");
  assert.equal(turn.reply, "Já chamei a equipe.");

  const refused = scripted([() => reply([], "refusal")]);
  const out = await runAssistant({
    create: refused.create,
    ctx,
    store,
    history: [],
    customerText: "...",
  });
  assert.ok(out.handoff);
  assert.match(out.reply, /equipe/);
});
