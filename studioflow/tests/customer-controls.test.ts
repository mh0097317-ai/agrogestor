import test from "node:test";
import assert from "node:assert/strict";
import { sealVault, openVault } from "../src/services/server-secrets";
import { bookingChannelLinks } from "../src/lib/booking-channel-links";
import { createSeed } from "../src/lib/seed";
import {
  professionalStore,
  systemPrompt,
  runTool,
} from "../src/services/assistant/agent";
import { tvBoard, tvName } from "../src/features/tv/tv-model";
import { openAiCreate } from "../src/services/assistant/provider";
import { saveAiKey } from "../src/services/admin-vault";
import type { Appointment } from "../src/types";

test("cofre: chaves cifradas e autenticadas por cliente/provedor", () => {
  const original = process.env.PAYMENTS_ENCRYPTION_KEY;
  process.env.PAYMENTS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const key = "sk-test-only-do-not-use",
      a = sealVault(key, "business:a:ai:openai"),
      b = sealVault(key, "business:a:ai:openai");
    assert.notEqual(a, b);
    assert.ok(!a.includes(key));
    assert.equal(openVault(a, "business:a:ai:openai"), key);
    assert.throws(() => openVault(a, "business:b:ai:openai"), /credencial/);
    assert.throws(() => openVault(a, "business:a:ai:anthropic"), /credencial/);
  } finally {
    if (original === undefined) delete process.env.PAYMENTS_ENCRYPTION_KEY;
    else process.env.PAYMENTS_ENCRYPTION_KEY = original;
  }
});
test("divulgação respeita canais e não inventa telefone", () => {
  const store = createSeed();
  store.settings.onlineBookingEnabled = false;
  store.business.phone = "";
  assert.deepEqual(bookingChannelLinks(store, "https://test"), {
    online: "",
    whatsapp: "",
  });
  store.business.phone = "(11) 98765-4321";
  assert.match(
    bookingChannelLinks(store, "https://test").whatsapp,
    /wa.me\/5511987654321/,
  );
  store.settings.onlineBookingEnabled = true;
  assert.equal(
    bookingChannelLinks(store, "https://test").online,
    `https://test/${store.business.slug}`,
  );
});
test("WhatsApp do profissional: identidade e ferramentas restritas à agenda correta", async () => {
  const store = createSeed(),
    pro = store.professionals.find((p) => p.active)!;
  const focused = professionalStore(store, pro.id);
  assert.equal(focused.professionals.length, 1);
  assert.ok(
    focused.services.every(
      (s) => s.professionalIds.length === 1 && s.professionalIds[0] === pro.id,
    ),
  );
  assert.match(
    systemPrompt(focused, false, "whatsapp", pro.id),
    new RegExp(pro.name),
  );
  assert.match(
    systemPrompt(focused, false, "whatsapp", pro.id),
    /sem afirmar ser a pessoa real/,
  );
  assert.throws(
    () => professionalStore(store, "other-tenant"),
    /não está disponível/,
  );
  const service = focused.services[0];
  let selected = "";
  const result = await runTool(
    "agendar",
    {
      servicos: [service.id],
      profissional: "another-person",
      inicio: "2026-10-08T18:00:00-03:00",
      nome: "Cliente Teste",
    },
    {
      channel: "whatsapp",
      professionalId: pro.id,
      verifiedPhone: "11987654321",
      origin: "https://test",
      payments: false,
      loadStore: async () => store,
      book: async (input) => {
        selected = input.professionalId;
        return {
          id: "appointment",
          customerName: "Cliente Teste",
          start: input.start,
          end: "2026-10-08T19:00:00-03:00",
          professionalId: input.professionalId,
          price: service.price,
          serviceIds: input.serviceIds,
        } as Appointment;
      },
    },
    {},
  );
  assert.equal(result.isError, undefined);
  assert.equal(selected, pro.id);
  const link = await runTool(
    "link_agendamento",
    { profissional: "another-person" },
    {
      channel: "whatsapp",
      professionalId: pro.id,
      verifiedPhone: "11987654321",
      origin: "https://test",
      payments: false,
      loadStore: async () => store,
      book: async () => {
        throw new Error("link must not book");
      },
    },
    {},
  );
  assert.equal(
    new URL(JSON.parse(link.content).link).searchParams.get("professional"),
    pro.id,
  );
});

test("cofre: valida modelo antes de salvar e só persiste chave cifrada", async () => {
  const originalFetch = globalThis.fetch;
  const variables = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "PAYMENTS_ENCRYPTION_KEY",
  ] as const;
  const original = variables.map((name) => process.env[name]);
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.test";
  process.env.SUPABASE_SECRET_KEY = "test-server-only-key";
  process.env.PAYMENTS_ENCRYPTION_KEY = Buffer.alloc(32, 4).toString("base64");
  let valid = false;
  let persisted: Record<string, string> | null = null;
  const key = "sk-test-credential-only-model";
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.startsWith("https://api.openai.com/v1/models/"))
      return Response.json({}, { status: valid ? 200 : 401 });
    if (target.includes("/rpc/platform_save_ai_key")) {
      persisted = JSON.parse(String(init?.body));
      return Response.json(null);
    }
    if (target.includes("/business_ai_credentials"))
      return Response.json({
        provider: "openai",
        model: "gpt-4.1",
        key_hint: key.slice(-4),
        updated_at: "2026-10-07T00:00:00Z",
      });
    throw new Error("Unexpected request");
  };
  try {
    await assert.rejects(
      saveAiKey("business-a", "admin", {
        provider: "openai",
        model: "gpt-4.1",
        key,
      }),
      /validados/,
    );
    assert.equal(persisted, null);
    valid = true;
    const view = await saveAiKey("business-a", "admin", {
      provider: "openai",
      model: "gpt-4.1",
      key,
    });
    const saved = persisted as Record<string, string> | null;
    assert.ok(saved);
    assert.equal(
      openVault(saved.p_secret, "business:business-a:ai:openai"),
      key,
    );
    assert.ok(!JSON.stringify(persisted).includes(key));
    assert.equal(view.hint, key.slice(-4));
    assert.ok(!JSON.stringify(view).includes(key));
  } finally {
    globalThis.fetch = originalFetch;
    variables.forEach((name, i) => {
      if (original[i] === undefined) delete process.env[name];
      else process.env[name] = original[i];
    });
  }
});
test("TV: fila completa, nomes abreviados e fora do expediente sem 'livre agora'", () => {
  const store = createSeed(),
    pro = store.professionals.find((p) => p.active)!;
  store.appointments = [];
  for (let i = 0; i < 9; i++)
    store.appointments.push({
      id: String(i),
      businessId: store.business.id,
      professionalId: pro.id,
      customerName: "Ana Silva",
      customerId: "test-customer",
      customerPhone: "11987654321",
      price: 50,
      reminder: false,
      start: `2026-10-07T${String(10 + i).padStart(2, "0")}:00:00-03:00`,
      end: `2026-10-07T${String(11 + i).padStart(2, "0")}:00:00-03:00`,
      status: "confirmed",
      serviceIds: [],
      createdAt: "",
    } as Appointment);
  const board = tvBoard(store, new Date("2026-10-07T08:00:00-03:00"));
  assert.equal(board.upcoming.length, 9);
  assert.equal(board.expected, 9);
  assert.equal(tvName("Ana Silva"), "Ana S.");
  const after = tvBoard(store, new Date("2026-10-07T23:00:00-03:00"));
  assert.ok(after.team.every((t) => t.state !== "free"));
});
test("OpenAI: o mesmo loop de ferramentas preserva chamadas, resultados e consumo", async () => {
  const original = globalThis.fetch;
  let request: Record<string, unknown> = {};
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(String(init?.body));
    return Response.json({
      id: "response",
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: "call-one",
                function: {
                  name: "horarios_livres",
                  arguments: '{"servicos":["one"]}',
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 15, completion_tokens: 9 },
    });
  };
  try {
    const result = await openAiCreate(
      "test-key",
      "gpt-4.1",
    )({
      model: "ignored",
      max_tokens: 100,
      system: "Dados reais",
      messages: [
        { role: "user", content: "Horário?" },
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "previous",
              name: "horarios_livres",
              input: {},
            },
          ],
        },
        {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "previous", content: "18h" },
          ],
        },
      ],
      tools: [{ name: "horarios_livres", input_schema: { type: "object" } }],
    });
    assert.equal(request.model, "gpt-4.1");
    assert.deepEqual((request.messages as Record<string, unknown>[])[3], {
      role: "tool",
      tool_call_id: "previous",
      content: "18h",
    });
    assert.equal(result.stop_reason, "tool_use");
    assert.equal(result.usage.input_tokens, 15);
    assert.equal(result.content[0].type, "tool_use");
  } finally {
    globalThis.fetch = original;
  }
});
