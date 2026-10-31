import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { availableSlots, localDate } from "../src/lib/availability";
import { readDemo, createDemoBusiness } from "../src/services/server-demo";
import {
  processConversation,
  type Conversation,
  type ConversationRepo,
} from "../src/services/assistant/conversations";
import { claudeCreate } from "../src/services/assistant/agent";
import { receptionistModel } from "../src/services/assistant/receptionist";
import type { BookingMenu } from "../src/services/assistant/booking-menu";
import type { ConversationMessage, Store } from "../src/types";

process.env.STUDIOFLOW_ASSISTANT_ENGINE = "v3";

/*
 * Conversas de verdade com o modelo de verdade, antes de cada publicação:
 *   npm run eval:recepcionista
 * Precisa de ANTHROPIC_API_KEY no ambiente (gasta crédito, ~US$ 1 por rodada).
 * Cada roteiro confere o que importa para o cliente: respondeu, não inventou,
 * não repetiu, marcou certo quando devia e só quando devia.
 */

const create = claudeCreate(receptionistModel);
const live = { skip: !create && "sem ANTHROPIC_API_KEY no ambiente" };

function memoryRepo() {
  const conversations = new Map<string, Conversation>();
  const messages = new Map<string, ConversationMessage[]>();
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
        aiCursor: new Date(Date.now() - 60_000).toISOString(),
      };
      conversations.set(item.id, item);
      messages.set(item.id, []);
      return item;
    },
    addMessage: async (id, role, body) => {
      messages.get(id)!.push({
        id: randomUUID(),
        role,
        body,
        createdAt: new Date().toISOString(),
      });
      // Distinct timestamps keep the transcript in order.
      await new Promise((resolve) => setTimeout(resolve, 3));
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

async function shop(name: string, customer = "") {
  const slug = `eval-${name}-${process.pid}`;
  const fixture = structuredClone(await readDemo("barber-011"));
  fixture.business.slug = slug;
  fixture.business.name = "Barbearia Exemplo";
  fixture.business.address = "Rua das Palmeiras, 120 - Centro";
  fixture.settings.assistantEnabled = true;
  fixture.settings.assistantName = "Bia";
  fixture.settings.minNotice = 0;
  fixture.settings.openDays = [1, 2, 3, 4, 5, 6];
  fixture.settings.openStart = "09:00";
  fixture.settings.openEnd = "20:00";
  fixture.appointments = [];
  fixture.customers = customer
    ? [
        {
          id: randomUUID(),
          businessId: fixture.business.id,
          name: customer,
          phone: "11912345678",
        } as Store["customers"][number],
      ]
    : [];
  await createDemoBusiness(fixture);
  const { repo, messages } = memoryRepo();
  const conversation = await repo.create({
    channel: "whatsapp",
    contactPhone: "11912345678",
    contactName: "",
  });
  const sent: { body: string; menu: BookingMenu | null | undefined }[] = [];
  const delivery = {
    slug,
    origin: "https://exemplo.test",
    send: async (body: string, menu?: BookingMenu | null) => {
      sent.push({ body, menu });
    },
  };
  const say = async (body: string) => {
    const before = sent.length;
    await repo.addMessage(conversation.id, "customer", body);
    const started = Date.now();
    await processConversation(repo, conversation.id, delivery, create);
    const out = sent.slice(before);
    console.log(
      `  cliente: ${body}\n${out.map((o) => `  bia (${((Date.now() - started) / 1000).toFixed(1)}s): ${o.body}${o.menu ? `\n    [lista: ${o.menu.title} · ${o.menu.rows.map((r) => r.title).join(" | ")}]` : ""}`).join("\n") || "  bia: (sem resposta)"}`,
    );
    return out;
  };
  const store = () => readDemo(slug);
  const cleanup = () =>
    unlink(join(process.cwd(), ".data", `demo-${slug}.json`)).catch(() => {});
  return {
    fixture,
    say,
    store,
    sent,
    cleanup,
    events: () =>
      messages.get(conversation.id)!.filter((m) => m.role === "event"),
  };
}

/** What no reply to a customer should ever look like. */
function clean(body: string) {
  assert.ok(body.trim(), "respondeu");
  assert.ok(body.length <= 700, `curta (${body.length})`);
  assert.doesNotMatch(
    body,
    /como posso (?:te )?ajudar|estou aqui para ajudar|\*\*|^#/im,
  );
  assert.doesNotMatch(body, /\b(?:SF_SLOT|undefined|null|NaN|\{|\})\b/);
  assert.ok((body.match(/\?/g) || []).length <= 2, "no máximo duas perguntas");
}
const timesIn = (text: string) =>
  [...text.matchAll(/\b([01]?\d|2[0-3])(?::([0-5]\d)|h([0-5]\d)?)(?!\d)/g)].map(
    (m) => `${m[1].padStart(2, "0")}:${m[2] || m[3] || "00"}`,
  );
const tomorrow = () => localDate(new Date(Date.now() + 86_400_000));
const service = (s: Store) => s.services.find((x) => x.active)!;

test("cumprimento: responde como gente, sem despejar lista", live, async () => {
  const t = await shop("hello");
  try {
    const [r] = await t.say("boa noite");
    clean(r.body);
    assert.equal(r.menu ?? null, null);
    assert.doesNotMatch(r.body, /R\$/);
  } finally {
    await t.cleanup();
  }
});

test("preço: valor real do catálogo", live, async () => {
  const t = await shop("price");
  try {
    const s = service(t.fixture);
    const [r] = await t.say(`quanto custa ${s.name.toLowerCase()}?`);
    clean(r.body);
    assert.match(
      r.body.replace(/\s/g, ""),
      new RegExp(String(Math.trunc(s.price))),
    );
  } finally {
    await t.cleanup();
  }
});

test(
  "horário de tarde: só oferece horários da tarde e reais",
  live,
  async () => {
    const t = await shop("afternoon");
    try {
      const s = service(t.fixture);
      const [r] = await t.say(`tem ${s.name.toLowerCase()} amanhã à tarde?`);
      clean(r.body);
      const free = new Set(
        availableSlots(await t.store(), [s.id], "any", tomorrow()).map(
          (x) => x.time,
        ),
      );
      for (const time of timesIn(r.body)) {
        assert.ok(time >= "12:00" && time < "18:00", `${time} é à tarde`);
        assert.ok(free.has(time), `${time} está livre`);
      }
    } finally {
      await t.cleanup();
    }
  },
);

test("marca do começo ao fim escrevendo", live, async () => {
  const t = await shop("book");
  try {
    const s = service(t.fixture);
    const [offer] = await t.say(
      `quero marcar ${s.name.toLowerCase()} amanhã de manhã`,
    );
    clean(offer.body);
    const time =
      timesIn(offer.body)[0] ||
      offer.menu?.rows.map((r) => timesIn(r.title)[0]).find(Boolean);
    assert.ok(time, "ofereceu um horário");
    const [ask] = await t.say(`pode ser às ${time}`);
    clean(ask.body);
    if (!(await t.store()).appointments.length) {
      const [done] = await t.say("Eduardo");
      clean(done.body);
    }
    const booked = (await t.store()).appointments;
    assert.equal(booked.length, 1, "marcou uma vez");
    assert.equal(booked[0].customerName.split(" ")[0], "Eduardo");
  } finally {
    await t.cleanup();
  }
});

test(
  "toca na lista e dá o nome: marca com o barbeiro tocado",
  live,
  async () => {
    const t = await shop("tap");
    try {
      const s = service(t.fixture);
      const pro = t.fixture.professionals.find((p) =>
        s.professionalIds.includes(p.id),
      )!;
      const day = localDate(new Date(Date.now() + 2 * 86_400_000));
      const slot = availableSlots(await t.store(), [s.id], pro.id, day)[0];
      const [ask] = await t.say(
        `SF_SLOT|${day}|${slot.time}|${pro.id}|${s.id}`,
      );
      clean(ask.body);
      assert.equal(ask.menu ?? null, null, "sem lista ao pedir o nome");
      const [done] = await t.say("me chama de dudu");
      clean(done.body);
      const booked = (await t.store()).appointments;
      assert.equal(booked.length, 1);
      assert.equal(booked[0].professionalId, pro.id);
    } finally {
      await t.cleanup();
    }
  },
);

test("cliente conhecido: não pede o nome de novo", live, async () => {
  const t = await shop("known", "Rafael Souza");
  try {
    const s = service(t.fixture);
    const [offer] = await t.say(`quero ${s.name.toLowerCase()} amanhã à tarde`);
    clean(offer.body);
    const time =
      timesIn(offer.body)[0] ||
      offer.menu?.rows.map((r) => timesIn(r.title)[0]).find(Boolean);
    assert.ok(time);
    const [r] = await t.say(`fechado, ${time}`);
    clean(r.body);
    assert.doesNotMatch(
      r.body,
      /como (?:você )?prefere ser chamado|qual (?:é )?o seu nome/i,
    );
  } finally {
    await t.cleanup();
  }
});

test("pergunta disponibilidade não marca sozinha", live, async () => {
  const t = await shop("ask");
  try {
    const s = service(t.fixture);
    await t.say(`tem ${s.name.toLowerCase()} amanhã às 10h?`);
    assert.equal((await t.store()).appointments.length, 0);
  } finally {
    await t.cleanup();
  }
});

test("endereço e funcionamento vêm dos dados", live, async () => {
  const t = await shop("info");
  try {
    const [a] = await t.say("onde fica a barbearia?");
    clean(a.body);
    assert.match(a.body, /Palmeiras/);
    const [b] = await t.say("vcs abrem domingo?");
    clean(b.body);
    assert.match(b.body, /n[aã]o|fechad/i);
  } finally {
    await t.cleanup();
  }
});

test("pede uma pessoa: passa para a equipe", live, async () => {
  const t = await shop("human");
  try {
    const [r] = await t.say("quero falar com o dono, por favor");
    clean(r.body);
    assert.ok(
      t.events().some((e) => /equipe/i.test(e.body)),
      "avisou o painel",
    );
  } finally {
    await t.cleanup();
  }
});

test("pechincha: não inventa desconto", live, async () => {
  const t = await shop("discount");
  try {
    const s = service(t.fixture);
    const [r] = await t.say(
      `${s.name.toLowerCase()} tá caro, faz por 10 reais?`,
    );
    clean(r.body);
    assert.doesNotMatch(r.body, /R\$\s?10\b|por 10 reais|fa[çc]o por 10/i);
  } finally {
    await t.cleanup();
  }
});

test("é robô?: responde com naturalidade", live, async () => {
  const t = await shop("bot");
  try {
    const [r] = await t.say("vc é um robô?");
    clean(r.body);
    assert.match(r.body, /virtual|assistente|atendente/i);
  } finally {
    await t.cleanup();
  }
});

test("papo fora do assunto: responde e não marca nada", live, async () => {
  const t = await shop("offtopic");
  try {
    const [r] = await t.say("viu o jogo ontem? que vergonha kkkk");
    clean(r.body);
    assert.equal((await t.store()).appointments.length, 0);
  } finally {
    await t.cleanup();
  }
});

test("serviço que não existe: não inventa", live, async () => {
  const t = await shop("missing");
  try {
    const [r] = await t.say("vcs fazem luzes e progressiva?");
    clean(r.body);
    assert.doesNotMatch(r.body, /progressiva (?:fica|custa|por) R\$/i);
  } finally {
    await t.cleanup();
  }
});

test(
  "áudio transcrito à noite: entende e oferece horário da noite",
  live,
  async () => {
    const t = await shop("audio");
    try {
      const s = service(t.fixture);
      const [r] = await t.say(
        `🎤 e aí, tem como fazer ${s.name.toLowerCase()} amanhã depois das 18?`,
      );
      clean(r.body);
      for (const time of timesIn(r.body).filter((x) => x !== "18:00"))
        assert.ok(time >= "18:00", `${time} é à noite`);
    } finally {
      await t.cleanup();
    }
  },
);

test(
  "agradecimento depois de marcar: fecha simpático, sem lista",
  live,
  async () => {
    const t = await shop("thanks");
    try {
      const s = service(t.fixture);
      const pro = t.fixture.professionals.find((p) =>
        s.professionalIds.includes(p.id),
      )!;
      const day = localDate(new Date(Date.now() + 2 * 86_400_000));
      const slot = availableSlots(await t.store(), [s.id], pro.id, day)[0];
      await t.say(`SF_SLOT|${day}|${slot.time}|${pro.id}|${s.id}`);
      await t.say("Lucas");
      const [r] = await t.say("valeu, obrigado!");
      if (r) {
        clean(r.body);
        assert.equal(r.menu ?? null, null);
      }
      assert.equal(
        (await t.store()).appointments.length,
        1,
        "não marcou de novo",
      );
    } finally {
      await t.cleanup();
    }
  },
);

test("mensagens em sequência viram uma resposta só", live, async () => {
  const t = await shop("burst");
  try {
    const s = service(t.fixture);
    const before = t.sent.length;
    const { say } = t;
    await Promise.all([
      say("oi"),
      say(`queria ver ${s.name.toLowerCase()} pra sexta`),
    ]);
    assert.ok(t.sent.length - before <= 2, "não duplicou");
  } finally {
    await t.cleanup();
  }
});
