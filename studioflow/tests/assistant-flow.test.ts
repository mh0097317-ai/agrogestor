import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { readDemo, createDemoBusiness } from "../src/services/server-demo";
import type Anthropic from "@anthropic-ai/sdk";
import {
  processConversation,
  type Conversation,
  type ConversationRepo,
} from "../src/services/assistant/conversations";
import type { CreateMessage } from "../src/services/assistant/agent";
import type { ConversationMessage } from "../src/types";

/** In-memory storage with the same contract as the database. */
function memoryRepo(realIds = false) {
  const conversations = new Map<string, Conversation>();
  const messages = new Map<string, ConversationMessage[]>();
  let clock = Date.parse("2026-10-04T12:00:00Z");
  const tick = () => new Date((clock += 1000)).toISOString();
  let leased = false;
  let turns = 0;
  const repo: ConversationRepo & {
    turns: () => number;
    leaseHeld: (v: boolean) => void;
  } = {
    businessId: realIds ? "11111111-1111-4111-8111-111111111111" : "b1",
    byToken: async () => null,
    byPhone: async () => null,
    byRef: async () => null,
    get: async (id) => {
      const item = conversations.get(id);
      return item ? structuredClone(item) : null;
    },
    create: async (input) => {
      const item: Conversation = {
        id: realIds ? randomUUID() : `c${conversations.size + 1}`,
        channel: input.channel,
        contactPhone: input.contactPhone,
        contactName: input.contactName,
        status: "ai",
        unread: 0,
        history: [],
        aiCursor: tick(),
      };
      conversations.set(item.id, item);
      messages.set(item.id, []);
      return item;
    },
    addMessage: async (id, role, body) => {
      messages.get(id)!.push({
        id: realIds ? randomUUID() : `m${Math.random()}`,
        role,
        body,
        createdAt: tick(),
      });
      return true;
    },
    messages: async (id, since) =>
      messages
        .get(id)!
        .filter((message) => !since || message.createdAt > since),
    lease: async () => (leased ? false : (leased = true)),
    release: async () => {
      leased = false;
    },
    update: async (id, patch) => {
      const item = conversations.get(id)!;
      Object.assign(item, {
        ...(patch.history ? { history: patch.history } : {}),
        ...(patch.aiCursor ? { aiCursor: patch.aiCursor } : {}),
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.unread !== undefined ? { unread: patch.unread } : {}),
      });
      if (patch.unreadDelta) item.unread += patch.unreadDelta;
    },
    takeTurn: async () => ++turns <= 2,
    addTokens: async () => undefined,
    turns: () => turns,
    leaseHeld: (value) => {
      leased = value;
    },
  };
  return { repo, messages };
}

const answer =
  (text: string): CreateMessage =>
  async (params) =>
    ({
      id: "m",
      type: "message",
      role: "assistant",
      model: "claude-opus-5-5",
      content: [
        {
          type: "text",
          text:
            params.max_tokens === 360
              ? JSON.stringify({
                  intent: "INFORMATION",
                  stage: "QUALIFYING",
                  confidence: 0.95,
                  serviceIds: [],
                  professionalId: "",
                  date: "",
                  time: "",
                  missing: [],
                  nextAction: "ANSWER",
                })
              : text,
          citations: null,
        },
      ],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 5 },
    }) as unknown as Anthropic.Beta.BetaMessage;

test("pending vague follow-up is interpreted with its own customer history, sent once and not replayed", async () => {
  const { repo, messages } = memoryRepo();
  const conversation = await repo.create({
    channel: "whatsapp",
    contactPhone: "11987654321",
    contactName: "Ana",
  });
  await repo.addMessage(conversation.id, "customer", "Quero cortar o cabelo");
  await repo.update(conversation.id, {
    aiCursor: messages.get(conversation.id)!.at(-1)!.createdAt,
  });
  await repo.addMessage(conversation.id, "customer", "Tem hoje?");
  const sent: string[] = [];
  const delivery = {
    origin: "https://test.invalid",
    slug: "barber-011",
    send: async (body: string) => void sent.push(body),
  };
  let interpretations = 0;
  const create: CreateMessage = async (params) => {
    if (params.max_tokens === 360) {
      interpretations++;
      assert.match(JSON.stringify(params.messages), /Quero cortar o cabelo/);
      assert.match(JSON.stringify(params.messages), /Tem hoje/);
    }
    return answer("Você quer com algum profissional específico?")(params);
  };
  await processConversation(repo, conversation.id, delivery, create);
  assert.equal(interpretations, 1);
  assert.deepEqual(sent, ["Você quer com algum profissional específico?"]);
  await processConversation(repo, conversation.id, delivery, create);
  assert.equal(sent.length, 1);
  assert.equal(interpretations, 1);
});

test("n8n live pipeline: one engine, persistent uncertain boundary, no duplicate/send after takeover", async () => {
  const savedEnv = process.env.N8N_WHATSAPP;
  const savedFetch = globalThis.fetch;
  const slug = `n8n-pipeline-${process.pid}`;
  const fixture = structuredClone(await readDemo("barber-011"));
  fixture.business.slug = slug;
  fixture.settings.assistantEnabled = true;
  await createDemoBusiness(fixture);
  try {
    for (const outcome of ["success", "timeout", "takeover"] as const) {
      const { repo } = memoryRepo(true);
      let state = "RECEIVED";
      repo.startRun = async () => {
        state = "UNDERSTANDING";
        return 1;
      };
      repo.progress = async (_id, patch) => {
        state = patch.state;
      };
      repo.run = async () => ({ state, attempts: 1 });
      process.env.N8N_WHATSAPP = JSON.stringify([
        {
          businessId: repo.businessId,
          professionalId: null,
          token: "x".repeat(32),
          basicUser: "test",
          basicPassword: "test",
        },
      ]);
      const conversation = await repo.create({
        channel: "whatsapp",
        contactPhone: "11987654321",
        contactName: "Ana",
      });
      await repo.addMessage(
        conversation.id,
        "customer",
        "Quero cortar o cabelo",
      );
      let networkCalls = 0;
      let classifierCalls = 0;
      globalThis.fetch = async (_url, init) => {
        networkCalls++;
        assert.equal(state, "SENDING");
        if (outcome === "timeout") throw new Error("timeout");
        if (outcome === "takeover")
          await repo.update(conversation.id, { status: "human" });
        const turn = JSON.parse(String(init?.body));
        return Response.json({
          version: 1,
          requestId: turn.requestId,
          sessionId: turn.sessionId,
          output: "Qual dia você prefere?",
          handoff: false,
          bookingPerformed: false,
        });
      };
      const create: CreateMessage = async (params) => {
        classifierCalls++;
        assert.equal(
          params.max_tokens,
          360,
          "internal reply engine must not run",
        );
        return answer("unused")(params);
      };
      const sent: string[] = [];
      const delivery = {
        slug,
        origin: "https://test.invalid",
        send: async (body: string) => {
          sent.push(body);
        },
      };
      await processConversation(repo, conversation.id, delivery, create);
      await processConversation(repo, conversation.id, delivery, create);
      assert.equal(networkCalls, 1);
      assert.equal(classifierCalls, 1);
      assert.deepEqual(
        sent,
        outcome === "success" ? ["Qual dia você prefere?"] : [],
      );
      assert.equal(
        (await repo.get(conversation.id))!.status,
        outcome === "success" ? "ai" : "human",
      );
    }
  } finally {
    await unlink(join(process.cwd(), ".data", `business-${slug}.json`)).catch(
      () => undefined,
    );
    globalThis.fetch = savedFetch;
    if (savedEnv === undefined) delete process.env.N8N_WHATSAPP;
    else process.env.N8N_WHATSAPP = savedEnv;
  }
});

test("conversas: responde pendentes, passa para a equipe sem chave e respeita o limite do dia", async () => {
  const { repo, messages } = memoryRepo();
  const sent: string[] = [];
  const delivery = {
    origin: "https://x.app",
    slug: "barber-011",
    send: async (body: string) => void sent.push(body),
  };
  const conversation = await repo.create({
    channel: "whatsapp",
    contactPhone: "11987654321",
    contactName: "Ana",
  });

  // Normal answer: goes out, cursor moves, nothing pending afterwards.
  await repo.addMessage(conversation.id, "customer", "Oi, que horas abre?");
  await processConversation(
    repo,
    conversation.id,
    delivery,
    answer("Abrimos às 9h."),
  );
  assert.deepEqual(sent, ["Abrimos às 9h."]);
  assert.equal((await repo.get(conversation.id))!.history.length, 2);
  await processConversation(
    repo,
    conversation.id,
    delivery,
    answer("não deveria"),
  );
  assert.equal(sent.length, 1);

  // Another answer in progress: this call leaves it to that one.
  await repo.addMessage(conversation.id, "customer", "E sábado?");
  repo.leaseHeld(true);
  await processConversation(
    repo,
    conversation.id,
    delivery,
    answer("não deveria"),
  );
  assert.equal(sent.length, 1);
  repo.leaseHeld(false);

  // Daily cap: queue the team, without unsolicited WhatsApp fallback text.
  await processConversation(
    repo,
    conversation.id,
    delivery,
    answer("Sábado também."),
  );
  await repo.addMessage(conversation.id, "customer", "Quanto está o corte?");
  await processConversation(
    repo,
    conversation.id,
    delivery,
    answer("não deveria"),
  );
  const fresh = (await repo.get(conversation.id))!;
  assert.equal(fresh.status, "human");
  assert.equal(fresh.unread, 1);
  assert.deepEqual(sent, ["Abrimos às 9h.", "Sábado também."]);
  assert.ok(
    messages
      .get(conversation.id)!
      .some((m) => m.role === "event" && /Limite/.test(m.body)),
  );

  // Human status: the AI stays quiet.
  await repo.addMessage(conversation.id, "customer", "Alô?");
  const before = sent.length;
  await processConversation(
    repo,
    conversation.id,
    delivery,
    answer("não deveria"),
  );
  assert.equal(sent.length, before);

  // No AI credentials: straight to the team.
  const other = await repo.create({
    channel: "web",
    contactPhone: "",
    contactName: "",
  });
  await repo.addMessage(other.id, "customer", "Oi");
  await processConversation(
    repo,
    other.id,
    { origin: "x", slug: "barber-011" },
    null,
  );
  assert.equal((await repo.get(other.id))!.status, "human");
});

test("recovery does not repeat a booking committed before a reply failure", async () => {
  const { repo } = memoryRepo();
  const conversation = await repo.create({
    channel: "whatsapp",
    contactPhone: "11987654321",
    contactName: "Ana",
  });
  await repo.addMessage(conversation.id, "customer", "Pode marcar o corte");
  repo.bookedSince = async (id, since) => {
    assert.equal(id, conversation.id);
    assert.ok(since > conversation.aiCursor);
    return true;
  };
  await processConversation(
    repo,
    conversation.id,
    {
      origin: "https://test",
      slug: "barber-011",
      send: async () => {
        throw new Error("must not send");
      },
    },
    async () => {
      throw new Error("must not repeat tools");
    },
  );
  assert.equal((await repo.get(conversation.id))!.status, "human");
  assert.equal(repo.turns(), 0);
});

test("existing WhatsApp chat: unrelated subject advances cursor without agent reply or tools", async () => {
  const { repo, messages } = memoryRepo();
  const conversation = await repo.create({
    channel: "whatsapp",
    contactPhone: "11987654321",
    contactName: "Cliente cadastrado",
  });
  await repo.addMessage(
    conversation.id,
    "customer",
    "Você viu o boleto do fornecedor?",
  );
  let classified = 0;
  const create: CreateMessage = async (params) => {
    assert.equal(
      params.max_tokens,
      8,
      "off-topic message must never reach the response/tool loop",
    );
    classified++;
    return {
      content: [{ type: "text", text: "NAO" }],
      usage: { input_tokens: 15, output_tokens: 1 },
    } as Anthropic.Beta.BetaMessage;
  };
  const sent: string[] = [];
  await processConversation(
    repo,
    conversation.id,
    {
      slug: "barber-011",
      origin: "https://local.test",
      send: async (body) => {
        sent.push(body);
      },
    },
    create,
  );
  await processConversation(
    repo,
    conversation.id,
    { slug: "barber-011", origin: "https://local.test" },
    create,
  );
  assert.equal(
    classified,
    0,
    "obvious personal message must never spend tokens or be reclassified",
  );
  assert.deepEqual(sent, []);
  assert.equal(
    messages.get(conversation.id)!.filter((m) => m.role === "assistant").length,
    0,
  );
  assert.equal((await repo.get(conversation.id))!.status, "ai");
});

test("WhatsApp classification failure stays silent instead of sending a handoff to personal chats", async () => {
  const { repo, messages } = memoryRepo();
  const conversation = await repo.create({
    channel: "whatsapp",
    contactPhone: "11987654321",
    contactName: "Contato",
  });
  await repo.addMessage(
    conversation.id,
    "customer",
    "Queria saber os horários disponíveis?",
  );
  const sent: string[] = [];
  await processConversation(
    repo,
    conversation.id,
    {
      slug: "barber-011",
      origin: "https://local.test",
      send: async (body) => {
        sent.push(body);
      },
    },
    async () => {
      throw new Error("classification unavailable");
    },
  );
  assert.deepEqual(sent, []);
  assert.ok(messages.get(conversation.id)!.some((m) => m.role === "event"));
  assert.equal(
    messages.get(conversation.id)!.some((m) => m.role === "assistant"),
    false,
  );
});

test("short booking continuation is classified with the same conversation's recent question", async () => {
  const { repo } = memoryRepo();
  const conversation = await repo.create({
    channel: "whatsapp",
    contactPhone: "11987654321",
    contactName: "Ana",
  });
  await repo.addMessage(
    conversation.id,
    "assistant",
    "Você prefere corte às 14h ou 18h?",
  );
  await repo.update(conversation.id, {
    aiCursor: (await repo.messages(conversation.id)).at(-1)!.createdAt,
  });
  await repo.addMessage(conversation.id, "customer", "18h");
  const create: CreateMessage = async (params) => {
    if (params.max_tokens === 360) {
      assert.match(
        String(params.messages[0].content),
        /Você prefere corte às 14h ou 18h/,
      );
      assert.match(String(params.messages[0].content), /MENSAGEM ATUAL.*\n18h/);
    }
    return answer("Vou conferir esse horário.")(params);
  };
  const sent: string[] = [];
  await processConversation(
    repo,
    conversation.id,
    {
      slug: "barber-011",
      origin: "https://local.test",
      send: async (body) => {
        sent.push(body);
      },
    },
    create,
  );
  assert.deepEqual(sent, ["Vou conferir esse horário."]);
});

test("human takeover during generation suppresses the stale AI reply", async () => {
  const { repo, messages } = memoryRepo();
  const conversation = await repo.create({
    channel: "whatsapp",
    contactPhone: "11987654321",
    contactName: "Ana",
  });
  await repo.addMessage(conversation.id, "customer", "Quanto está o corte?");
  const sent: string[] = [];
  const create: CreateMessage = async (params) => {
    if (params.max_tokens !== 360)
      await repo.update(conversation.id, { status: "human" });
    return answer("Resposta que a equipe já assumiu.")(params);
  };
  await processConversation(
    repo,
    conversation.id,
    {
      slug: "barber-011",
      origin: "https://local.test",
      send: async (body) => {
        sent.push(body);
      },
    },
    create,
  );
  assert.deepEqual(sent, []);
  assert.equal((await repo.get(conversation.id))!.status, "human");
  assert.equal(
    messages.get(conversation.id)!.some((m) => m.role === "assistant"),
    false,
  );
});
