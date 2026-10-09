import test from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { createSeed } from "../src/lib/seed";
import {
  recentTranscript,
  understandMessage,
} from "../src/services/assistant/understanding";
import { failureCode, retryable } from "../src/services/assistant/pipeline";
import { openAiCreate } from "../src/services/assistant/provider";
import { conversationFromRow } from "../src/services/assistant/conversations";
import {
  runAssistant,
  runTool,
  type CreateMessage,
} from "../src/services/assistant/agent";

const store = createSeed();
test("database conversation decoding preserves provider tool result and input field names", () => {
  const history = [
    {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "lookup",
          name: "horarios_livres",
          input: { service_ids: ["service"] },
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "lookup",
          is_error: false,
          content: "[]",
        },
      ],
    },
  ];
  const result = conversationFromRow({
    id: "conversation",
    contact_phone: "62912345678",
    whatsapp_professional_id: "professional",
    ai_cursor: "cursor",
    history,
  });
  assert.equal(result?.contactPhone, "62912345678");
  assert.equal(result?.whatsappProfessionalId, "professional");
  assert.equal(result?.aiCursor, "cursor");
  assert.deepEqual(result?.history, history);
  assert.equal(conversationFromRow(null), null);
});
test("a model cannot bypass interpretation and create an unconfirmed booking", async () => {
  let bookings = 0;
  const result = await runTool(
    "agendar",
    { servicos: [store.services[0].id] },
    {
      channel: "whatsapp",
      origin: "https://test",
      payments: false,
      bookingAllowed: false,
      loadStore: async () => store,
      book: async () => {
        bookings++;
        throw new Error("must not book");
      },
    },
    {},
  );
  assert.equal(result.isError, true);
  assert.equal(bookings, 0);
});
const understood = {
  intent: "AVAILABILITY",
  stage: "QUALIFYING",
  confidence: 0.98,
  serviceIds: [],
  professionalId: "",
  date: "",
  time: "",
  missing: ["service"],
  nextAction: "ASK",
};
const response = (content: string) =>
  ({
    content: [{ type: "text", text: content }],
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 10 },
  }) as Anthropic.Beta.BetaMessage;

test("price interpretation forces a constrained tool and still rejects foreign entities", async () => {
  const price = {
    ...understood,
    intent: "PRICE",
    nextAction: "ANSWER",
    missing: [],
    serviceIds: [store.services[0].id],
  };
  const classify: CreateMessage = async (params) => {
    assert.deepEqual(params.tool_choice, {
      type: "tool",
      name: "interpretar_pedido",
    });
    const tool = params.tools?.[0];
    assert.ok(tool && "input_schema" in tool);
    assert.equal(tool.strict, true);
    const schema = tool.input_schema as {
      properties: { missing: { items: { enum: string[] } } };
    };
    assert.equal(schema.properties.missing.items.enum.includes("price"), false);
    return {
      ...response(""),
      content: [
        {
          type: "tool_use",
          id: "interpretation",
          name: "interpretar_pedido",
          input: price,
        },
      ],
    } as Anthropic.Beta.BetaMessage;
  };
  assert.equal(
    (await understandMessage(classify, "Quanto está o corte?", store, []))
      .interpretation.nextAction,
    "ANSWER",
  );
  await assert.rejects(
    understandMessage(
      async (params) => {
        const result = await classify(params);
        return {
          ...result,
          content: [
            {
              type: "tool_use",
              id: "interpretation",
              name: "interpretar_pedido",
              input: { ...price, serviceIds: ["foreign"] },
            },
          ],
        } as Anthropic.Beta.BetaMessage;
      },
      "Quanto está o corte?",
      store,
      [],
    ),
    /invalid-entity/,
  );
});

test("OpenAI preserves the forced interpretation tool and schema", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.tool_choice, {
      type: "function",
      function: { name: "interpretar_pedido" },
    });
    assert.equal(body.tools[0].function.strict, true);
    return Response.json({
      id: "test",
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: "tool",
                function: {
                  name: "interpretar_pedido",
                  arguments: JSON.stringify({
                    ...understood,
                    intent: "PRICE",
                    nextAction: "ANSWER",
                    missing: [],
                  }),
                },
              },
            ],
          },
        },
      ],
    });
  };
  try {
    const result = await understandMessage(
      openAiCreate("test", "test"),
      "Quanto está o corte?",
      store,
      [],
    );
    assert.equal(result.interpretation.intent, "PRICE");
  } finally {
    globalThis.fetch = original;
  }
});

test("explicit personal topics cannot be answered even if the model would approve them", async () => {
  const create: CreateMessage = async () => {
    throw new Error("must not call model");
  };
  const recent = [
    {
      id: "question",
      role: "assistant" as const,
      body: "Quer marcar um corte?",
      createdAt: "2026-10-07T19:00:00Z",
    },
  ];
  for (const text of [
    "O almoço está pronto",
    "Mãe, me liga",
    "Tem Coca-Cola 2L?",
    "Qual o valor do corte de energia?",
    "🎤 O jantar está pronto",
  ])
    assert.equal(
      (await understandMessage(create, text, store, recent)).interpretation
        .nextAction,
      "SILENCE",
    );
  assert.equal(
    (await understandMessage(create, "Boa tarde", store, [])).interpretation
      .nextAction,
    "SILENCE",
  );
});

test("availability without a service remains a valid commercial question, not silent rejection", async () => {
  const result = await understandMessage(
    async (params) => {
      assert.equal(params.max_tokens, 360);
      assert.match(String(params.system), /Nunca escreva uma resposta/);
      return response(JSON.stringify(understood));
    },
    "Queria saber os horários disponíveis?",
    store,
    [],
  );
  assert.equal(result.interpretation.nextAction, "ASK");
  assert.deepEqual(result.interpretation.missing, ["service"]);
});

test("interpretation uses exactly six visible messages and rejects fabricated entities", async () => {
  const transcript = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    role: "customer" as const,
    body: `Pedido ${i}`,
    createdAt: `2026-10-07T19:00:0${i}Z`,
  }));
  transcript.push({
    id: "event",
    role: "event" as never,
    body: "internal key diagnostic",
    createdAt: "2026-10-07T19:00:10Z",
  });
  const recent = recentTranscript(transcript, "2026-10-07T19:00:11Z");
  assert.deepEqual(
    recent.map((m) => m.body),
    ["Pedido 4", "Pedido 5", "Pedido 6", "Pedido 7", "Pedido 8", "Pedido 9"],
  );
  await assert.rejects(
    understandMessage(
      async () =>
        response(
          JSON.stringify({
            ...understood,
            serviceIds: ["foreign-tenant-service"],
          }),
        ),
      "Quero marcar corte",
      store,
      recent,
    ),
    /invalid-entity/,
  );
  await assert.rejects(
    understandMessage(
      async () => response("SIM"),
      "Quero marcar corte",
      store,
      recent,
    ),
  );
});

test("short answers continue a commercial question but never initiate an unrelated chat", async () => {
  const create: CreateMessage = async () =>
    response(
      JSON.stringify({
        ...understood,
        intent: "CONTINUE",
        stage: "CHOOSING_TIME",
        time: "18h",
      }),
    );
  const recent = [
    {
      id: "q",
      role: "staff" as const,
      body: "Tenho corte às 18h. Quer marcar?",
      createdAt: "2026-10-07T19:00:00Z",
    },
  ];
  assert.equal(
    (await understandMessage(create, "18h", store, recent)).interpretation
      .intent,
    "CONTINUE",
  );
  assert.equal(
    (await understandMessage(create, "18h", store, [])).interpretation
      .nextAction,
    "SILENCE",
  );
  assert.equal(
    (
      await understandMessage(
        create,
        "[O cliente enviou um áudio.]",
        store,
        recent,
      )
    ).interpretation.nextAction,
    "SILENCE",
  );
});

test("low confidence asks before acting and retries are bounded to transient provider failures", async () => {
  assert.equal(
    (
      await understandMessage(
        async () =>
          response(
            JSON.stringify({
              ...understood,
              confidence: 0.42,
              nextAction: "CONFIRM",
            }),
          ),
        "Quero marcar corte",
        store,
        [],
      )
    ).interpretation.nextAction,
    "ASK",
  );
  assert.equal(
    failureCode(
      Object.assign(new Error("secret payload never logged"), { status: 401 }),
    ),
    "provider-auth",
  );
  assert.equal(
    retryable(Object.assign(new Error("bad request"), { status: 400 })),
    false,
  );
  assert.equal(
    retryable(Object.assign(new Error("rate limit"), { status: 429 })),
    true,
  );
});

test("quality supervisor rewrites a generic reply once without repeating tools", async () => {
  let calls = 0;
  const result = await runAssistant({
    create: async (params) => {
      calls++;
      if (calls === 2) assert.equal(params.tools, undefined);
      return response(
        calls === 1
          ? "Como posso auxiliá-lo?"
          : "Qual serviço você quer marcar?",
      );
    },
    store,
    history: [],
    customerText: "Queria saber os horários disponíveis?",
    ctx: {
      channel: "whatsapp",
      origin: "https://test",
      payments: false,
      loadStore: async () => store,
      book: async () => {
        throw new Error("must not book");
      },
    },
  });
  assert.equal(result.reply, "Qual serviço você quer marcar?");
  assert.equal(calls, 2);
});

test("qualification uses contextual language while keeping booking tools unavailable", async () => {
  const stages: string[] = [];
  const result = await runAssistant({
    create: async (params) => {
      assert.equal(
        params.tools?.some((tool) => "name" in tool && tool.name === "agendar"),
        false,
      );
      return response(
        "Vamos encontrar um horário que encaixe no seu dia! Você está pensando em corte ou barba?",
      );
    },
    store,
    history: [],
    customerText: "Queria saber os horários disponíveis?",
    interpretation: {
      ...understood,
      intent: "AVAILABILITY",
      stage: "QUALIFYING",
      nextAction: "ASK",
      missing: ["service"],
    },
    onStage: async (stage) => {
      stages.push(stage);
    },
    ctx: {
      channel: "whatsapp",
      origin: "https://test",
      payments: false,
      loadStore: async () => store,
      book: async () => {
        throw new Error("must not book");
      },
    },
  });
  assert.match(result.reply, /\?$/);
  assert.equal(result.usage.input, 10);
  assert.deepEqual(stages, ["GENERATING", "VALIDATING"]);
});

test("empty final answers are repaired once without replaying tools or empty assistant blocks", async () => {
  let calls = 0;
  const result = await runAssistant({
    create: async (params) => {
      calls++;
      if (calls === 1) return { ...response(""), content: [] };
      assert.equal(params.tools, undefined);
      assert.equal(
        params.messages.some(
          (message) =>
            Array.isArray(message.content) && !message.content.length,
        ),
        false,
      );
      return response("O corte custa R$30,00.");
    },
    store,
    history: [],
    customerText: "Quanto está o corte?",
    ctx: {
      channel: "whatsapp",
      origin: "https://test",
      payments: false,
      loadStore: async () => store,
      book: async () => {
        throw new Error("must not book");
      },
    },
  });
  assert.equal(result.reply, "O corte custa R$30,00.");
  assert.equal(calls, 2);
});

test("truncated tool calls are discarded before execution or replay", async () => {
  let calls = 0;
  const result = await runAssistant({
    create: async (params) => {
      calls++;
      assert.deepEqual(params.tool_choice, {
        type: "auto",
        disable_parallel_tool_use: true,
      });
      if (calls === 1)
        return {
          ...response(""),
          stop_reason: "max_tokens",
          content: [
            { type: "tool_use", id: "unfinished", name: "agendar", input: {} },
          ],
        } as Anthropic.Beta.BetaMessage;
      assert.equal(params.max_tokens, 1200);
      assert.equal(
        JSON.stringify(params.messages).includes("unfinished"),
        false,
      );
      return response("O corte custa R$30,00.");
    },
    store,
    history: [],
    customerText: "Quanto está o corte?",
    ctx: {
      channel: "whatsapp",
      origin: "https://test",
      payments: false,
      loadStore: async () => store,
      book: async () => {
        throw new Error("must not book");
      },
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.reply, "O corte custa R$30,00.");
});
