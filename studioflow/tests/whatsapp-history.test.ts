import test from "node:test";
import assert from "node:assert/strict";
import { mirrorMessages } from "../src/services/whatsapp/history";
import {
  parseEvolution,
  parseEvolutionChanges,
} from "../src/services/whatsapp/evolution";

const raw = (id: string, text: string, fromMe = false) => ({
  key: { id, fromMe, remoteJid: "5511987654321@s.whatsapp.net" },
  message: { conversation: text },
  messageTimestamp: 1791543600,
});
test("only provider messages appear, including manual replies; phantom local notes disappear", () => {
  const stored = [
    {
      id: "phantom",
      role: "assistant" as const,
      body: "Not on WhatsApp",
      createdAt: "2026-10-09T11:00:00Z",
    },
    {
      id: "sent",
      role: "assistant" as const,
      body: "Old text",
      createdAt: "2026-10-09T11:00:00Z",
      providerMessageId: "professional:one",
    },
  ];
  const records = [
    raw("one", "Edited real text", true),
    raw("two", "Reply from phone", true),
    raw("three", "Customer"),
    raw("three", "Customer"),
    { ...raw("deleted", "Deleted"), MessageUpdate: [{ status: "DELETED" }] },
  ];
  const messages = mirrorMessages(records, stored, "test");
  assert.equal(messages.length, 3);
  assert.deepEqual(
    messages.map((m) => m.body),
    ["Edited real text", "Reply from phone", "Customer"],
  );
  assert.deepEqual(
    messages.map((m) => m.role),
    ["assistant", "staff", "customer"],
  );
  assert.equal(messages[0].id, "sent");
  assert.ok(
    messages.every(
      (m) => m.createdAt === new Date(1791543600 * 1000).toISOString(),
    ),
  );
});
test("outgoing echoes use the destination phone and are not interpreted as customer requests", () => {
  const body = {
    event: "MESSAGES_UPSERT",
    instance: "test",
    data: {
      ...raw("out", "A reply", true),
      sender: "5511999999999@s.whatsapp.net",
    },
  };
  assert.equal(parseEvolution(body).messages.length, 0);
  assert.equal(parseEvolution(body, true).messages[0].from, "5511987654321");
  assert.equal(parseEvolution(body, true).messages[0].fromMe, true);
});
test("deletion controls accept provider IDs and real phones, never group or opaque LID numbers", () => {
  assert.deepEqual(
    parseEvolutionChanges({
      event: "MESSAGES_DELETE",
      data: { id: "database-id", key: { id: "real-provider-id" } },
    }),
    { messages: ["real-provider-id"], phones: [] },
  );
  assert.deepEqual(
    parseEvolutionChanges({
      event: "CHATS_DELETE",
      data: ["5511987654321@s.whatsapp.net", "123@lid", "123@g.us"],
    }),
    { messages: [], phones: ["11987654321"] },
  );
  assert.deepEqual(
    parseEvolutionChanges({
      event: "CONTACTS_UPSERT",
      data: { id: "not-a-message" },
    }),
    { messages: [], phones: [] },
  );
});
