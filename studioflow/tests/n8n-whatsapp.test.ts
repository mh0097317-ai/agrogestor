import test from "node:test";
import assert from "node:assert/strict";
import { n8nWhatsAppTurn } from "../src/services/assistant/n8n-whatsapp-contract";
import {
  n8nWhatsAppConfiguration,
  requestN8nTurn,
  N8nTurnError,
} from "../src/services/assistant/n8n-whatsapp";
import { verifiedN8nReply } from "../src/services/assistant/n8n-reply";
import { readDemo } from "../src/services/server-demo";
import type { Interpretation } from "../src/services/assistant/understanding";

const config = {
  businessId: "08a87f89-544b-42ac-af0a-3b4a9a07a90d",
  professionalId: null,
  token: "x".repeat(32),
  basicUser: "test",
  basicPassword: "password",
};
const turn = n8nWhatsAppTurn({
  businessId: config.businessId,
  professionalId: null,
  conversationId: "5b8d866d-4224-45ae-85ba-8c4a84208b34",
  channel: "whatsapp",
  status: "ai",
  messages: [
    {
      id: "6fe1bd68-e32b-4c0b-82f2-349431419c06",
      text: "Quero cortar o cabelo",
      createdAt: "2026-10-09T12:54:00.000Z",
    },
  ],
});
const reply = {
  version: 1,
  requestId: turn.requestId,
  sessionId: turn.sessionId,
  output: "Qual dia você prefere?",
  handoff: false,
  bookingPerformed: false,
};

test("n8n engine selection is exact and fails closed for duplicate/malformed configuration", () => {
  const raw = JSON.stringify([config]);
  assert.deepEqual(
    n8nWhatsAppConfiguration(config.businessId, null, raw),
    config,
  );
  assert.equal(
    n8nWhatsAppConfiguration(
      config.businessId,
      "6ce4eaa6-ed45-4d8f-be3e-0d2593196c5e",
      raw,
    ),
    null,
  );
  assert.equal(n8nWhatsAppConfiguration("another-business", null, raw), null);
  assert.throws(() =>
    n8nWhatsAppConfiguration(
      config.businessId,
      null,
      JSON.stringify([config, config]),
    ),
  );
  assert.throws(() =>
    n8nWhatsAppConfiguration(config.businessId, null, "invalid"),
  );
});

test("n8n transport sends scoped data once with separate authentication and bounded deadline", async () => {
  let calls = 0;
  const transport: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(
      url,
      "https://n8n.studioflowapp.tech/webhook/studioflow-whatsapp",
    );
    assert.equal(init?.redirect, "error");
    assert.equal(
      new Headers(init?.headers).get("x-studioflow-n8n-token"),
      config.token,
    );
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      `Basic ${Buffer.from("test:password").toString("base64")}`,
    );
    assert.deepEqual(JSON.parse(String(init?.body)), turn);
    return Response.json(reply);
  };
  assert.deepEqual(await requestN8nTurn(turn, config, transport), reply);
  assert.equal(calls, 1);
  await assert.rejects(
    requestN8nTurn(
      turn,
      { ...config, professionalId: "6ce4eaa6-ed45-4d8f-be3e-0d2593196c5e" },
      transport,
    ),
    N8nTurnError,
  );
  assert.equal(calls, 1);
});

test("n8n never retries timeout, HTML, HTTP error, invalid correlation or oversized response", async () => {
  for (const result of [
    new Error("private secret"),
    new Response("HTML"),
    new Response("secret", { status: 503 }),
    Response.json({ ...reply, requestId: "0".repeat(64) }),
    Response.json({ ...reply, output: "x".repeat(20000) }),
  ]) {
    let calls = 0;
    const transport: typeof fetch = async () => {
      calls++;
      if (result instanceof Error) throw result;
      return result;
    };
    await assert.rejects(
      requestN8nTurn(turn, config, transport),
      (error) =>
        error instanceof N8nTurnError && !error.message.includes("private"),
    );
    assert.equal(calls, 1);
  }
});

const interpretation: Interpretation = {
  intent: "INFORMATION",
  stage: "QUALIFYING",
  confidence: 0.95,
  serviceIds: [],
  professionalId: "",
  date: "",
  time: "",
  missing: [],
  nextAction: "ANSWER",
};

test("n8n proposals cannot confirm bookings or offer unverified prices/slots", async () => {
  const store = await readDemo("barber-011");
  for (const output of [
    "Agendamento confirmado!",
    "Temos vagas",
    "Pode ser às 09:30",
    "Corte custa R$ 500",
    "São 500 reais",
  ])
    assert.throws(() =>
      verifiedN8nReply(output, interpretation, store, "Quero corte"),
    );
  assert.equal(
    verifiedN8nReply("Qual dia prefere?", interpretation, store, "Quero corte")
      .reply,
    "Qual dia prefere?",
  );
  assert.equal(
    verifiedN8nReply(
      "Vou verificar",
      { ...interpretation, intent: "BOOK" },
      store,
      "Pode marcar",
    ).handoff,
    true,
  );
  const service = store.services.find((s) => s.active)!;
  const price = verifiedN8nReply(
    "Preço incorreto: R$ 999",
    { ...interpretation, intent: "PRICE", serviceIds: [service.id] },
    store,
    "Quanto custa?",
  );
  assert.ok(price.reply.includes(service.name));
  assert.ok(!price.reply.includes("999"));
});

test("n8n slot proposals are replaced with fresh availability rather than stale model prose", async () => {
  const store = await readDemo("barber-011");
  const service = store.services.find((s) => s.active)!;
  const result = verifiedN8nReply(
    "Temos horários às 03:00",
    {
      ...interpretation,
      intent: "AVAILABILITY",
      serviceIds: [service.id],
      date: "2026-10-10",
    },
    store,
    "Quero de manhã",
    new Date("2026-10-09T12:00:00Z"),
  );
  assert.ok(!result.reply.includes("03:00"));
  assert.ok(result.reply.includes("10/10/2026"));
  assert.equal(result.handoff, false);
});
