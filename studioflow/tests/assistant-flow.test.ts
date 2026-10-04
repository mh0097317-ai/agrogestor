import test from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import {
  processConversation,
  type Conversation,
  type ConversationRepo,
} from "../src/services/assistant/conversations";
import type { CreateMessage } from "../src/services/assistant/agent";
import type { ConversationMessage } from "../src/types";

/** In-memory storage with the same contract as the database. */
function memoryRepo() {
  const conversations = new Map<string, Conversation>();
  const messages = new Map<string, ConversationMessage[]>();
  let clock = Date.parse("2026-10-04T12:00:00Z");
  const tick = () => new Date((clock += 1000)).toISOString();
  let leased = false;
  let turns = 0;
  const repo: ConversationRepo & { turns: () => number; leaseHeld: (v: boolean) => void } = {
    businessId: "b1",
    byToken: async () => null,
    byPhone: async () => null,
    byRef: async () => null,
    get: async (id) => {
      const item = conversations.get(id);
      return item ? structuredClone(item) : null;
    },
    create: async (input) => {
      const item: Conversation = {
        id: `c${conversations.size + 1}`,
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
      messages.get(id)!.push({ id: `m${Math.random()}`, role, body, createdAt: tick() });
      return true;
    },
    messages: async (id, since) =>
      messages.get(id)!.filter((message) => !since || message.createdAt > since),
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

const answer = (text: string): CreateMessage => async () =>
  ({
    id: "m",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text, citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  }) as unknown as Anthropic.Beta.BetaMessage;

test("conversas: responde pendentes, passa para a equipe sem chave e respeita o limite do dia", async () => {
  const { repo, messages } = memoryRepo();
  const sent: string[] = [];
  const delivery = { origin: "https://x.app", slug: "barber-011", send: async (body: string) => void sent.push(body) };
  const conversation = await repo.create({ channel: "whatsapp", contactPhone: "11987654321", contactName: "Ana" });

  // Normal answer: goes out, cursor moves, nothing pending afterwards.
  await repo.addMessage(conversation.id, "customer", "Oi, que horas abre?");
  await processConversation(repo, conversation.id, delivery, answer("Abrimos às 9h."));
  assert.deepEqual(sent, ["Abrimos às 9h."]);
  assert.equal((await repo.get(conversation.id))!.history.length, 2);
  await processConversation(repo, conversation.id, delivery, answer("não deveria"));
  assert.equal(sent.length, 1);

  // Another answer in progress: this call leaves it to that one.
  await repo.addMessage(conversation.id, "customer", "E sábado?");
  repo.leaseHeld(true);
  await processConversation(repo, conversation.id, delivery, answer("não deveria"));
  assert.equal(sent.length, 1);
  repo.leaseHeld(false);

  // Daily cap reached (2 turns in this fake): hand over, notify the customer.
  await processConversation(repo, conversation.id, delivery, answer("Sábado também."));
  await repo.addMessage(conversation.id, "customer", "Obrigado");
  await processConversation(repo, conversation.id, delivery, answer("não deveria"));
  const fresh = (await repo.get(conversation.id))!;
  assert.equal(fresh.status, "human");
  assert.equal(fresh.unread, 1);
  assert.match(sent.at(-1)!, /equipe/);
  assert.ok(messages.get(conversation.id)!.some((m) => m.role === "event" && /Limite/.test(m.body)));

  // Human status: the AI stays quiet.
  await repo.addMessage(conversation.id, "customer", "Alô?");
  const before = sent.length;
  await processConversation(repo, conversation.id, delivery, answer("não deveria"));
  assert.equal(sent.length, before);

  // No AI credentials: straight to the team.
  const other = await repo.create({ channel: "web", contactPhone: "", contactName: "" });
  await repo.addMessage(other.id, "customer", "Oi");
  await processConversation(repo, other.id, { origin: "x", slug: "barber-011" }, null);
  assert.equal((await repo.get(other.id))!.status, "human");
});
