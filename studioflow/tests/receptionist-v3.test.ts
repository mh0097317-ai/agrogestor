import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { availableSlots, localDate } from "../src/lib/availability";
import { readDemo, createDemoBusiness } from "../src/services/server-demo";
import {
  processConversation,
  type Conversation,
  type ConversationRepo,
} from "../src/services/assistant/conversations";
import type { BookingMenu } from "../src/services/assistant/booking-menu";
import type { CreateMessage } from "../src/services/assistant/agent";
import { receptionistModel } from "../src/services/assistant/receptionist";
import type { ConversationMessage } from "../src/types";

process.env.STUDIOFLOW_ASSISTANT_ENGINE = "v3";

/*
 * The v3 receptionist with a scripted model: what reaches the model, what
 * reaches the customer and what the code refuses, without a real API call.
 */
type Params = Parameters<CreateMessage>[0];
type Step = (params: Params) => Anthropic.Beta.BetaMessage;

const reply = (text: string) =>
  ({
    id: randomUUID(),
    type: "message",
    role: "assistant",
    model: receptionistModel,
    content: [{ type: "text", text, citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  }) as unknown as Anthropic.Beta.BetaMessage;
const tool = (name: string, input: Record<string, unknown>) =>
  ({
    id: randomUUID(),
    type: "message",
    role: "assistant",
    model: receptionistModel,
    content: [{ type: "tool_use", id: `t${randomUUID()}`, name, input }],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  }) as unknown as Anthropic.Beta.BetaMessage;
/** The text of the last tool result the model received. */
const lastResult = (params: Params) => {
  const last = params.messages.at(-1)!;
  const block = Array.isArray(last.content)
    ? last.content.find((b) => b.type === "tool_result")
    : null;
  return block && block.type === "tool_result" ? String(block.content) : "";
};
const lastText = (params: Params) => {
  const last = params.messages.at(-1)!;
  return typeof last.content === "string"
    ? last.content
    : last.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
};

function memoryRepo() {
  const conversations = new Map<string, Conversation>();
  const messages = new Map<string, ConversationMessage[]>();
  let clock = Date.now() - 600_000;
  const tick = () => new Date((clock += 1000)).toISOString();
  let leased = false;
  const repo: ConversationRepo = {
    businessId: "b1",
    byToken: async () => null,
    byPhone: async () => null,
    byRef: async () => null,
    get: async (id) => structuredClone(conversations.get(id) || null),
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
      messages
        .get(id)!
        .push({ id: randomUUID(), role, body, createdAt: tick() });
      return true;
    },
    messages: async (id, since) =>
      messages.get(id)!.filter((m) => !since || m.createdAt > since),
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
      });
    },
    takeTurn: async () => true,
    addTokens: async () => undefined,
  };
  return { repo, messages };
}

async function setup(name: string) {
  const slug = `v3-${name}-${process.pid}`;
  const fixture = structuredClone(await readDemo("barber-011"));
  fixture.business.slug = slug;
  fixture.settings.assistantEnabled = true;
  fixture.settings.minNotice = 0;
  fixture.settings.openDays = [0, 1, 2, 3, 4, 5, 6];
  const service = fixture.services.find((s) => s.active)!;
  service.name = "corte";
  fixture.services = [service];
  const pros = fixture.professionals
    .filter((p) => service.professionalIds.includes(p.id))
    .slice(0, 2);
  for (const p of pros) p.days = [0, 1, 2, 3, 4, 5, 6];
  fixture.professionals = pros;
  fixture.appointments = [];
  fixture.customers = [];
  await createDemoBusiness(fixture);
  const { repo, messages } = memoryRepo();
  const conversation = await repo.create({
    channel: "whatsapp",
    contactPhone: "11912345678",
    contactName: "",
  });
  const sent: { body: string; menu: BookingMenu | null | undefined }[] = [];
  const calls: Params[] = [];
  let script: Step[] = [];
  const create: CreateMessage = async (params) => {
    calls.push(structuredClone(params));
    const step = script.shift();
    if (!step) throw Error("unexpected model call");
    return step(params);
  };
  const delivery = {
    slug,
    origin: "https://test.invalid",
    send: async (body: string, menu?: BookingMenu | null) => {
      sent.push({ body, menu });
    },
  };
  const say = async (body: string, steps: Step[]) => {
    script = steps;
    const before = sent.length;
    await repo.addMessage(conversation.id, "customer", body);
    await processConversation(repo, conversation.id, delivery, create);
    assert.equal(script.length, 0, "every scripted step was used");
    return sent.slice(before);
  };
  const day = localDate(new Date(Date.now() + 3 * 86400000));
  const slot = (pro = pros[1], index = 0) =>
    availableSlots(fixture, [service.id], pro.id, day)[index];
  const cleanup = () =>
    unlink(join(process.cwd(), ".data", `demo-${slug}.json`)).catch(() => {});
  return {
    slug,
    service,
    pros,
    day,
    slot,
    say,
    calls,
    sent,
    messages: () => messages.get(conversation.id)!,
    cleanup,
  };
}

test("a greeting is one model call, no forced tool, no list", async () => {
  const t = await setup("hello");
  try {
    const out = await t.say("boa tarde", [
      () => reply("Boa tarde! Tudo bem? Quer marcar um corte hoje?"),
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].menu, null);
    assert.equal(t.calls.length, 1);
    assert.equal(t.calls[0].model, receptionistModel);
    assert.deepEqual(t.calls[0].tool_choice, {
      type: "auto",
      disable_parallel_tool_use: true,
    });
    assert.equal(t.calls[0].output_config?.effort, "low");
  } finally {
    await t.cleanup();
  }
});

test("the list the model asks for goes with its message and is logged", async () => {
  const t = await setup("list");
  try {
    let offered = "";
    const out = await t.say("quero cortar segunda que vem", [
      () =>
        tool("ver_horarios", {
          servicos: [t.service.id],
          data: t.day,
          profissional: "any",
          periodo: "all",
          depois_de: "",
        }),
      (params) => {
        const report = JSON.parse(lastResult(params));
        offered = report.profissionais[0].horarios[0].hora;
        return tool("mostrar_lista", {
          tipo: "horarios",
          servicos: [t.service.id],
          data: t.day,
          profissional: "any",
          periodo: "all",
        });
      },
      (params) => {
        assert.match(lastResult(params), /vai junto com a sua mensagem/);
        return reply(`Tenho às ${offered}. Os outros estão na lista.`);
      },
    ]);
    assert.equal(out.length, 1);
    assert.match(out[0].body, new RegExp(offered));
    assert.ok(out[0].menu?.rows.some((r) => r.id.startsWith("SF_SLOT|")));
    assert.ok(
      t
        .messages()
        .some((m) => m.role === "event" && m.body.startsWith("Lista enviada")),
    );
  } finally {
    await t.cleanup();
  }
});

test("a time the agenda never gave is sent back for a rewrite", async () => {
  const t = await setup("invented");
  try {
    const out = await t.say("tem horário amanhã?", [
      () => reply("Tenho às 07:13 livre amanhã!"),
      (params) => {
        assert.match(lastText(params), /não vieram da agenda/);
        return reply("Vou olhar a agenda: qual serviço você quer?");
      },
    ]);
    assert.equal(out.length, 1);
    assert.match(out[0].body, /qual serviço/);
  } finally {
    await t.cleanup();
  }
});

test("saying it booked without booking is sent back", async () => {
  const t = await setup("claim");
  try {
    const out = await t.say("pode marcar", [
      () => reply("Prontinho, está marcado!"),
      (params) => {
        assert.match(lastText(params), /Nada foi marcado/);
        return reply("Me diz o dia e o horário que eu já vejo pra você.");
      },
    ]);
    assert.match(out[0].body, /dia e o horário/);
  } finally {
    await t.cleanup();
  }
});

test("a wrong price is sent back", async () => {
  const t = await setup("price");
  try {
    const out = await t.say("quanto é o corte?", [
      () => reply("O corte fica R$ 999,00."),
      (params) => {
        assert.match(lastText(params), /não existe no catálogo/);
        return reply(`O corte fica ${t.service.price} reais.`);
      },
    ]);
    assert.equal(out.length, 1);
  } finally {
    await t.cleanup();
  }
});

test("tap a slot, give the name: booked with the barber who was tapped", async () => {
  const t = await setup("book");
  try {
    const pro = t.pros[1];
    const slot = t.slot(pro);
    const asked = await t.say(
      `SF_SLOT|${t.day}|${slot.time}|${pro.id}|${t.service.id}`,
      [
        (params) => {
          assert.match(
            lastText(params),
            /\[Tocou na lista\] Escolhi corte com/,
          );
          assert.match(lastText(params), new RegExp(`às ${slot.time}`));
          return reply("Ótima escolha! Como você prefere ser chamado?");
        },
      ],
    );
    assert.equal(asked[0].menu, null);
    const done = await t.say("Me chama de dudu", [
      () =>
        tool("agendar", {
          servicos: [t.service.id],
          profissional: pro.id,
          inicio: slot.start,
          nome: "Dudu",
          telefone: "",
          cpf: "",
        }),
      (params) => {
        assert.match(lastResult(params), /"marcado":true/);
        return reply(`Fechado, Dudu! Te espero às ${slot.time}.`);
      },
    ]);
    assert.match(done[0].body, /Fechado, Dudu/);
    const store = await readDemo(t.slug);
    assert.equal(store.appointments.length, 1);
    assert.equal(store.appointments[0].professionalId, pro.id);
    assert.equal(store.appointments[0].customerName, "Dudu");
  } finally {
    await t.cleanup();
  }
});

test("booking a time nobody offered or chose is refused", async () => {
  const t = await setup("guard");
  try {
    const slot = t.slot(t.pros[0], 3);
    await t.say("me encaixa em qualquer horário", [
      () =>
        tool("agendar", {
          servicos: [t.service.id],
          profissional: t.pros[0].id,
          inicio: slot.start,
          nome: "Carlos",
          telefone: "",
          cpf: "",
        }),
      (params) => {
        assert.match(lastResult(params), /não foi oferecido/);
        return reply("Claro! Prefere de manhã ou à tarde?");
      },
    ]);
    assert.equal((await readDemo(t.slug)).appointments.length, 0);
  } finally {
    await t.cleanup();
  }
});

test("silence sends nothing", async () => {
  const t = await setup("silent");
  try {
    const out = await t.say("👍", [() => tool("ficar_em_silencio", {})]);
    assert.equal(out.length, 0);
  } finally {
    await t.cleanup();
  }
});

test("a failure on first contact stays silent for the team to see", async () => {
  const t = await setup("fail-first");
  try {
    assert.equal((await t.say("oi, tem horário hoje?", [])).length, 0);
    assert.ok(t.messages().some((m) => m.role === "event"));
  } finally {
    await t.cleanup();
  }
});

test("a failure mid-conversation still gets a polite answer", async () => {
  const t = await setup("fail-mid");
  try {
    await t.say("oi", [() => reply("Oi! Quer marcar um corte?")]);
    const out = await t.say("quero sim", []);
    assert.equal(out.length, 1);
    assert.match(out[0].body, /Já chamei alguém da equipe/);
    assert.ok(t.messages().some((m) => m.role === "event"));
  } finally {
    await t.cleanup();
  }
});

test("booking the customer's own slot again says it is already booked", async () => {
  const t = await setup("again");
  try {
    const pro = t.pros[0];
    const slot = t.slot(pro);
    const book = () =>
      tool("agendar", {
        servicos: [t.service.id],
        profissional: pro.id,
        inicio: slot.start,
        nome: "Lucas",
        telefone: "",
        cpf: "",
      });
    await t.say(`SF_SLOT|${t.day}|${slot.time}|${pro.id}|${t.service.id}`, [
      () => reply("Como você prefere ser chamado?"),
    ]);
    await t.say("Lucas", [book, () => reply("Fechado, Lucas!")]);
    await t.say("valeu!", [
      book,
      (params) => {
        assert.match(lastResult(params), /já está marcado para este cliente/);
        return reply("Por nada, Lucas! Até lá.");
      },
    ]);
    assert.equal((await readDemo(t.slug)).appointments.length, 1);
  } finally {
    await t.cleanup();
  }
});

async function bookLucas(t: Awaited<ReturnType<typeof setup>>) {
  const pro = t.pros[0];
  const slot = t.slot(pro);
  await t.say(`SF_SLOT|${t.day}|${slot.time}|${pro.id}|${t.service.id}`, [
    () => reply("Como você prefere ser chamado?"),
  ]);
  await t.say("Lucas", [
    () =>
      tool("agendar", {
        servicos: [t.service.id],
        profissional: pro.id,
        inicio: slot.start,
        nome: "Lucas",
        telefone: "",
        cpf: "",
      }),
    () => reply("Fechado, Lucas!"),
  ]);
  return { pro, slot };
}
const codeIn = (params: Params) =>
  /código ([0-9a-f]{8})/.exec(lastText(params))?.[1] || "";

test("cancels the customer's own booking only after the tool runs", async () => {
  const t = await setup("cancel");
  try {
    await bookLucas(t);
    let code = "";
    await t.say("não vou conseguir ir, pode cancelar", [
      (params) => {
        code = codeIn(params);
        assert.ok(code, "the booking code reaches the model");
        return reply("Poxa! Cancelei aqui, tá?");
      },
      (params) => {
        assert.match(lastText(params), /Nada foi cancelado/);
        return tool("cancelar_horario", { codigo: code });
      },
      (params) => {
        assert.match(lastResult(params), /Horário cancelado/);
        return reply("Pronto, Lucas, cancelado. Quando quiser, é só chamar!");
      },
    ]);
    const store = await readDemo(t.slug);
    assert.equal(store.appointments.length, 1);
    assert.equal(store.appointments[0].status, "cancelled");
  } finally {
    await t.cleanup();
  }
});

test("reschedules in place instead of booking a second time", async () => {
  const t = await setup("move");
  try {
    const { pro } = await bookLucas(t);
    const later = t.slot(pro, 4);
    let code = "";
    await t.say(`dá pra passar pras ${later.time}?`, [
      (params) => {
        code = codeIn(params);
        return tool("remarcar_horario", {
          codigo: code,
          inicio: later.start,
          profissional: pro.id,
        });
      },
      (params) => {
        assert.match(lastResult(params), /remarcado/);
        return reply(`Feito! Passei pras ${later.time}.`);
      },
    ]);
    const store = await readDemo(t.slug);
    assert.equal(store.appointments.length, 1);
    assert.equal(
      Date.parse(store.appointments[0].start),
      Date.parse(later.start),
    );
    // Someone else's code or a made-up one is refused.
    await t.say("cancela o horário abc12345", [
      () => tool("cancelar_horario", { codigo: "abc12345" }),
      (params) => {
        assert.match(lastResult(params), /Não achei esse horário/);
        return reply("Não achei esse horário aqui.");
      },
    ]);
  } finally {
    await t.cleanup();
  }
});
