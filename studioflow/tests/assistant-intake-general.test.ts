import test from "node:test";
import assert from "node:assert/strict";
import { receiveWhatsAppMessages } from "../src/services/assistant/conversations";

test("a new WhatsApp contact's greeting or general question reaches the inbox when IA is enabled; disabled, outgoing and duplicate messages stay suppressed", async () => {
  const previous = {
    fetch: globalThis.fetch,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://intake.example.test";
  process.env.SUPABASE_SECRET_KEY = "local-test-secret";
  let enabled = true,
    duplicate = false;
  const writes: { table: string; data: Record<string, unknown> }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://intake.example.test");
    const table = url.pathname.split("/").at(-1)!;
    const method = init?.method || "GET";
    if (method === "POST") {
      const data = JSON.parse(String(init?.body));
      writes.push({ table, data });
      if (table === "conversations")
        return Response.json({
          ...data,
          id: `c${writes.length}`,
          status: "ai",
          unread: 0,
          history: [],
          ai_cursor: new Date(0).toISOString(),
        });
      assert.equal(table, "conversation_messages");
      return new Response(null, { status: 201 });
    }
    if (method === "PATCH") return new Response(null, { status: 204 });
    if (table === "businesses") return Response.json([{ slug: "test-shop" }]);
    if (table === "platform_access")
      return Response.json([
        { status: "active", access_until: null, modules: ["recepcionista"] },
      ]);
    if (table === "platform_ai_control")
      return Response.json([{ enabled: true }]);
    if (table === "business_settings")
      return Response.json([{ assistant_enabled: enabled }]);
    if (table === "conversation_messages")
      return Response.json(duplicate ? [{ id: "seen" }] : []);
    if (table === "conversations" || table === "customers")
      return Response.json([]);
    throw Error(`Unexpected mocked request: ${table}`);
  };
  const base = {
    businessId: "b1",
    tenantId: "t1",
    origin: "https://test.invalid",
    professionalId: "p1",
    send: async () => {
      throw Error("Intake must not send directly");
    },
  };
  try {
    for (const [index, text] of [
      "Boa noite",
      "Qual a capital da França?",
      "Você viu o jogo ontem?",
    ].entries()) {
      await receiveWhatsAppMessages({
        ...base,
        messages: [
          { id: `m${index}`, from: "5562999999999", name: "Teste", text },
        ],
      });
    }
    assert.equal(writes.filter((w) => w.table === "conversations").length, 3);
    assert.deepEqual(
      writes
        .filter((w) => w.table === "conversation_messages")
        .map((w) => w.data.body),
      ["Boa noite", "Qual a capital da França?", "Você viu o jogo ontem?"],
    );
    assert.ok(
      writes.every(
        (w) => w.data.business_id === "b1" && w.data.tenant_id === "t1",
      ),
    );
    const before = writes.length;
    enabled = false;
    await receiveWhatsAppMessages({
      ...base,
      messages: [
        { id: "disabled", from: "5562999999999", name: "Teste", text: "Olá" },
      ],
    });
    enabled = true;
    await receiveWhatsAppMessages({
      ...base,
      messages: [
        {
          id: "outgoing",
          from: "5562999999999",
          name: "Teste",
          text: "Olá",
          fromMe: true,
        },
      ],
    });
    duplicate = true;
    await receiveWhatsAppMessages({
      ...base,
      messages: [
        { id: "m0", from: "5562999999999", name: "Teste", text: "Boa noite" },
      ],
    });
    assert.equal(writes.length, before);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previous.key;
  }
});
