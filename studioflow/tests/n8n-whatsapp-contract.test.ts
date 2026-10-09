import test from "node:test";
import assert from "node:assert/strict";
import {
  n8nWhatsAppTurn,
  n8nWhatsAppReply,
} from "../src/services/assistant/n8n-whatsapp-contract";

const input = {
  businessId: "08a87f89-544b-42ac-af0a-3b4a9a07a90d",
  professionalId: "6ce4eaa6-ed45-4d8f-be3e-0d2593196c5e",
  conversationId: "5b8d866d-4224-45ae-85ba-8c4a84208b34",
  channel: "whatsapp" as const,
  status: "ai" as const,
  messages: [
    {
      id: "6fe1bd68-e32b-4c0b-82f2-349431419c06",
      text: "Quero consultar corte para sábado de manhã.",
      createdAt: "2026-10-09T12:54:00.000Z",
    },
  ],
};

test("n8n contract: sessions isolate tenants, professionals and customers", () => {
  const first = n8nWhatsAppTurn(input);
  for (const patch of [
    { businessId: "c17e27aa-a4bc-4d60-94d2-73595ac873c8" },
    { conversationId: "c17e27aa-a4bc-4d60-94d2-73595ac873c8" },
    { professionalId: null },
  ]) {
    const next = n8nWhatsAppTurn({ ...input, ...patch });
    assert.notEqual(next.sessionId, first.sessionId);
    assert.notEqual(next.requestId, first.requestId);
  }
  assert.deepEqual(n8nWhatsAppTurn(input), first);
});

test("n8n contract: only verified WhatsApp AI turns can be prepared", () => {
  for (const patch of [
    { status: "human" },
    { status: "closed" },
    { channel: "web" },
    { contactPhone: "11999999999" },
    { token: "secret" },
    { messages: [] },
    { messages: [input.messages[0], input.messages[0]] },
  ])
    assert.throws(() => n8nWhatsAppTurn({ ...input, ...patch } as never));
  const turn = n8nWhatsAppTurn(input);
  assert.equal(turn.context.bookingAllowed, false);
  assert.equal(turn.test, false);
  assert.equal(JSON.stringify(turn).includes("contactPhone"), false);
});

test("n8n contract: different pending turns have different correlation IDs", () => {
  const first = n8nWhatsAppTurn(input);
  const next = n8nWhatsAppTurn({
    ...input,
    messages: [
      {
        ...input.messages[0],
        id: "ba1adf13-f056-49bb-83ec-e89d290d9eaf",
        text: "Pode ser 09:00.",
      },
    ],
  });
  assert.equal(first.sessionId, next.sessionId);
  assert.notEqual(first.requestId, next.requestId);
  const reply = {
    version: 1,
    requestId: first.requestId,
    sessionId: first.sessionId,
    output: "Há opções para esse período.",
    handoff: false,
    bookingPerformed: false,
  };
  assert.equal(n8nWhatsAppReply(reply, first).output, reply.output);
  assert.throws(() => n8nWhatsAppReply(reply, next), /mismatch/);
});

test("n8n contract: acknowledgments, uncorrelated replies and booking claims fail closed", () => {
  const turn = n8nWhatsAppTurn(input);
  const reply = {
    version: 1,
    requestId: turn.requestId,
    sessionId: turn.sessionId,
    output: "Como posso ajudar?",
    handoff: false,
    bookingPerformed: false,
  };
  for (const raw of [
    { message: "Workflow was started" },
    { ...reply, sessionId: "studioflow-teste" },
    { ...reply, bookingPerformed: true },
    { ...reply, output: "" },
    { ...reply, output: "a".repeat(4001) },
    { ...reply, output: "🧑".repeat(2100) },
    { ...reply, appointment: { id: "made-up" } },
  ])
    assert.throws(() => n8nWhatsAppReply(raw, turn));
  assert.throws(
    () =>
      n8nWhatsAppTurn({
        ...input,
        messages: Array.from({ length: 5 }, (_, n) => ({
          ...input.messages[0],
          id: `00000000-0000-4000-8000-00000000000${n}`,
          text: "x".repeat(4000),
        })),
      }),
    /text-too-large/,
  );
});
