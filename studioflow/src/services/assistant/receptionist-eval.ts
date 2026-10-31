import { randomUUID } from "node:crypto";
import { availableSlots, DomainError, localDate } from "@/lib/availability";
import type { Appointment, Store } from "@/types";
import type { CreateMessage } from "./engine/agent-loop";
import type { AssistantContext } from "./agent";
import type { BookingMenu } from "./booking-menu";
import { receptionistTurn, upcomingFor } from "./receptionist";

/*
 * Conversas de teste da recepcionista com o modelo de verdade, numa cópia da
 * agenda em memória: nada é salvo e nenhuma mensagem sai. Roda no servidor
 * (botão no /admin, com a chave da própria loja) ou localmente
 * (npm run eval:recepcionista). Cada roteiro confere o que importa para o
 * cliente: respondeu, não inventou, não repetiu, marcou certo e só quando devia.
 */

export interface EvalTurn {
  customer: string;
  reply: string;
  list: string;
  seconds: number;
}
export interface EvalResult {
  name: string;
  ok: boolean;
  problems: string[];
  turns: EvalTurn[];
}

const phone = "11900000000";
const timesIn = (text: string) =>
  [...text.matchAll(/\b([01]?\d|2[0-3])(?::([0-5]\d)|h([0-5]\d)?)(?!\d)/g)].map(
    (m) => `${m[1].padStart(2, "0")}:${m[2] || m[3] || "00"}`,
  );

/** One chat with a fresh copy of the shop. */
class Chat {
  store: Store;
  earlier: { role: "user" | "assistant"; text: string }[] = [];
  turns: EvalTurn[] = [];
  problems: string[] = [];
  handoffs = 0;
  menus: (BookingMenu | null)[] = [];
  constructor(
    base: Store,
    private create: CreateMessage,
    private customerName = "",
  ) {
    this.store = structuredClone(base);
    this.store.appointments = this.store.appointments.filter(
      (a) => a.customerPhone.replace(/\D/g, "") !== phone,
    );
  }
  get booked() {
    return this.store.appointments.filter((a) => a.customerPhone === phone);
  }
  async say(text: string) {
    const ctx: AssistantContext = {
      channel: "whatsapp",
      verifiedPhone: phone,
      customerName: this.customerName || undefined,
      origin: "https://studioflow.test",
      payments: false,
      loadStore: async () => this.store,
      book: async (input) => {
        const slot = availableSlots(
          this.store,
          input.serviceIds,
          input.professionalId,
          localDate(new Date(input.start)),
        ).find((s) => s.start === input.start);
        if (!slot)
          throw new DomainError("Esse horário acabou de ser ocupado.", 409);
        const services = this.store.services.filter((s) =>
          input.serviceIds.includes(s.id),
        );
        const appointment = {
          id: randomUUID(),
          businessId: this.store.business.id,
          customerId: "",
          customerName: input.name,
          customerPhone: phone,
          customerEmail: "",
          professionalId: slot.professionalId,
          serviceIds: input.serviceIds,
          start: slot.start,
          end: new Date(
            Date.parse(slot.start) +
              services.reduce((sum, s) => sum + s.duration, 0) * 60_000,
          ).toISOString(),
          status: "confirmed",
          price: services.reduce((sum, s) => sum + s.price, 0),
          reminder: true,
          notes: "",
          token: "teste",
          createdAt: new Date().toISOString(),
        } as Appointment;
        this.store.appointments.push(appointment);
        return appointment;
      },
    };
    const known = this.earlier.slice(-12).flatMap((m) => timesIn(m.text));
    const started = Date.now();
    const turn = await receptionistTurn({
      create: this.create,
      store: this.store,
      ctx,
      earlier: this.earlier,
      text,
      known,
      // As in WhatsApp: the receptionist knows what this number has booked.
      context: upcomingFor(this.store, phone, new Date()),
    });
    const seconds = (Date.now() - started) / 1000;
    if (turn.handoff) this.handoffs++;
    this.menus.push(turn.menu);
    this.earlier.push({ role: "user", text });
    if (turn.reply)
      this.earlier.push({
        role: "assistant",
        text: turn.menu
          ? `${turn.reply}\n[Lista enviada: ${turn.menu.title}: ${turn.menu.rows.map((r) => r.title).join(", ")}]`
          : turn.reply,
      });
    this.turns.push({
      customer: text,
      reply: turn.reply,
      list: turn.menu
        ? `${turn.menu.title}: ${turn.menu.rows.map((r) => r.title).join(" | ")}`
        : "",
      seconds: Math.round(seconds * 10) / 10,
    });
    if (seconds > 20) this.problems.push(`demorou ${seconds.toFixed(0)} s`);
    return turn;
  }
  /** What no reply to a customer should ever look like. */
  clean(reply: string) {
    if (!reply.trim()) return this.problems.push("ficou sem resposta");
    if (reply.length > 700) this.problems.push("mensagem longa demais");
    if (/como posso (?:te )?ajudar|estou aqui para ajudar/i.test(reply))
      this.problems.push("frase de robô");
    if (/\*\*|^#|SF_SLOT|undefined|NaN/m.test(reply))
      this.problems.push("formatação ou código vazando");
    if ((reply.match(/\?/g) || []).length > 2)
      this.problems.push("perguntas demais numa mensagem");
  }
  expect(ok: boolean, problem: string) {
    if (!ok) this.problems.push(problem);
  }
}

interface Scenario {
  name: string;
  customer?: string;
  run: (chat: Chat, shop: ShopFacts) => Promise<void>;
}
interface ShopFacts {
  service: Store["services"][number];
  professional: Store["professionals"][number];
  day: string;
  slot: { time: string; start: string };
  free: (date: string) => Set<string>;
}

const lower = (value: string) => value.toLowerCase();

export const scenarios: Scenario[] = [
  {
    name: "Cumprimento",
    run: async (c) => {
      const r = await c.say("boa noite");
      c.clean(r.reply);
      c.expect(!r.menu, "mandou lista num cumprimento");
      c.expect(!/R\$/.test(r.reply), "despejou preço sem pedirem");
    },
  },
  {
    name: "Preço do serviço",
    run: async (c, s) => {
      const r = await c.say(`quanto custa ${lower(s.service.name)}?`);
      c.clean(r.reply);
      c.expect(
        r.reply
          .replace(/\s/g, "")
          .includes(String(Math.trunc(s.service.price))),
        "não disse o preço real",
      );
    },
  },
  {
    name: "Horário à tarde",
    run: async (c, s) => {
      const r = await c.say(
        `tem ${lower(s.service.name)} ${s.day === localDate(new Date(Date.now() + 86_400_000)) ? "amanhã" : `dia ${s.day.slice(8)}`} à tarde?`,
      );
      c.clean(r.reply);
      const free = s.free(s.day);
      for (const t of timesIn(r.reply)) {
        c.expect(t >= "12:00" && t < "18:00", `ofereceu ${t}, fora da tarde`);
        c.expect(free.has(t), `ofereceu ${t}, que não está livre`);
      }
    },
  },
  {
    name: "Marca escrevendo, do começo ao fim",
    run: async (c, s) => {
      const offer = await c.say(
        `quero marcar ${lower(s.service.name)} dia ${s.day.slice(8)}/${s.day.slice(5, 7)}`,
      );
      c.clean(offer.reply);
      const time =
        timesIn(offer.reply)[0] ||
        offer.menu?.rows.map((r) => timesIn(r.title)[0]).find(Boolean);
      if (!time) return void c.problems.push("não ofereceu horário");
      const next = await c.say(`pode ser às ${time}`);
      c.clean(next.reply);
      if (!c.booked.length) {
        const done = await c.say("Eduardo");
        c.clean(done.reply);
      }
      c.expect(c.booked.length === 1, "não marcou (ou marcou duas vezes)");
    },
  },
  {
    name: "Toca na lista e dá o nome",
    run: async (c, s) => {
      const ask = await c.say(
        `SF_SLOT|${s.day}|${s.slot.time}|${s.professional.id}|${s.service.id}`,
      );
      c.clean(ask.reply);
      c.expect(!ask.menu, "mandou lista ao pedir o nome");
      const done = await c.say("me chama de dudu");
      c.clean(done.reply);
      c.expect(c.booked.length === 1, "não marcou depois do nome");
      c.expect(
        c.booked[0]?.professionalId === s.professional.id,
        "marcou com outro barbeiro",
      );
    },
  },
  {
    name: "Cliente conhecido não repete o nome",
    customer: "Rafael Souza",
    run: async (c, s) => {
      const r = await c.say(
        `SF_SLOT|${s.day}|${s.slot.time}|${s.professional.id}|${s.service.id}`,
      );
      c.clean(r.reply);
      c.expect(
        !/prefere ser chamado|qual (?:é )?o seu nome|seu nome/i.test(r.reply),
        "pediu o nome de quem já é cliente",
      );
      if (!c.booked.length) {
        const done = await c.say("pode marcar");
        c.clean(done.reply);
      }
      c.expect(c.booked.length === 1, "não marcou");
    },
  },
  {
    name: "Perguntar não é marcar",
    run: async (c, s) => {
      const r = await c.say(
        `tem ${lower(s.service.name)} dia ${s.day.slice(8)} às ${s.slot.time}?`,
      );
      c.clean(r.reply);
      c.expect(!c.booked.length, "marcou só porque perguntaram");
    },
  },
  {
    name: "Endereço",
    run: async (c, s) => {
      const r = await c.say("onde fica a barbearia?");
      c.clean(r.reply);
      void s;
      const street = c.store.business.address.split(/[,-]/)[0].trim();
      if (street)
        c.expect(
          lower(r.reply).includes(lower(street).slice(0, 12)),
          "não deu o endereço cadastrado",
        );
    },
  },
  {
    name: "Pede uma pessoa",
    run: async (c) => {
      const r = await c.say("quero falar com o dono, por favor");
      c.clean(r.reply);
      c.expect(c.handoffs > 0, "não passou para a equipe");
    },
  },
  {
    name: "Pechincha",
    run: async (c, s) => {
      const r = await c.say(
        `${lower(s.service.name)} tá caro, faz por 10 reais?`,
      );
      c.clean(r.reply);
      c.expect(
        !/R\$\s?10\b|por 10 reais|fa[çc]o por 10/i.test(r.reply),
        "deu desconto sem autorização",
      );
    },
  },
  {
    name: "É robô?",
    run: async (c) => {
      const r = await c.say("vc é um robô?");
      c.clean(r.reply);
      c.expect(
        /virtual|assistente|atendente|intelig/i.test(r.reply),
        "não respondeu com naturalidade quem ela é",
      );
    },
  },
  {
    name: "Papo fora do assunto",
    run: async (c) => {
      const r = await c.say("viu o jogo ontem? que vergonha kkkk");
      c.clean(r.reply);
      c.expect(!c.booked.length, "marcou algo do nada");
      c.expect(!r.menu, "mandou lista num papo");
    },
  },
  {
    name: "Serviço que não existe",
    run: async (c) => {
      const r = await c.say("vcs fazem luzes e progressiva?");
      c.clean(r.reply);
      c.expect(
        !/progressiva (?:fica|custa|sai|por) R\$/i.test(r.reply),
        "inventou preço de serviço que não existe",
      );
    },
  },
  {
    name: "Áudio pedindo à noite",
    run: async (c, s) => {
      const r = await c.say(
        `🎤 e aí, tem como fazer ${lower(s.service.name)} dia ${s.day.slice(8)} depois das 18?`,
      );
      c.clean(r.reply);
      // With nothing after 18h, saying so and offering earlier is right.
      const none =
        /n[aã]o (?:tem|h[aá]|tenho|consigo)|sem hor[aá]rio|lotad|ocupad/i.test(
          r.reply,
        );
      if (!none)
        for (const t of timesIn(r.reply).filter((x) => x !== "18:00"))
          c.expect(t >= "18:00", `ofereceu ${t}, antes das 18h, sem avisar`);
    },
  },
  {
    name: "Agradece depois de marcar",
    run: async (c, s) => {
      await c.say(
        `SF_SLOT|${s.day}|${s.slot.time}|${s.professional.id}|${s.service.id}`,
      );
      await c.say("Lucas");
      const r = await c.say("valeu, obrigado!");
      if (r.reply) c.clean(r.reply);
      c.expect(!r.menu, "mandou lista no agradecimento");
      c.expect(c.booked.length === 1, "não marcou, ou marcou de novo");
    },
  },
  {
    name: "Mensagens juntas",
    run: async (c, s) => {
      const r = await c.say(
        `oi\nqueria ver ${lower(s.service.name)} pra semana que vem`,
      );
      c.clean(r.reply);
    },
  },
];

/** The shop facts every scenario relies on: a service, who does it, a free day. */
function facts(store: Store, now: Date): ShopFacts | null {
  for (const service of store.services.filter((s) => s.active)) {
    for (const professional of store.professionals.filter(
      (p) => p.active && service.professionalIds.includes(p.id),
    )) {
      for (let offset = 1; offset <= 10; offset++) {
        const day = localDate(new Date(now.getTime() + offset * 86_400_000));
        const slots = availableSlots(
          store,
          [service.id],
          professional.id,
          day,
          now,
        );
        if (slots.length >= 3)
          return {
            service,
            professional,
            day,
            slot: slots[Math.floor(slots.length / 2)],
            free: (date) =>
              new Set(
                availableSlots(store, [service.id], "any", date, now).map(
                  (s) => s.time,
                ),
              ),
          };
      }
    }
  }
  return null;
}

/** Runs every scenario (a few at a time) and reports what failed. */
export async function runReceptionistEval(
  store: Store,
  create: CreateMessage,
  options: { only?: string[]; concurrency?: number } = {},
): Promise<EvalResult[]> {
  const shop = facts(store, new Date());
  if (!shop)
    throw new DomainError(
      "A loja precisa de um serviço ativo com profissional e horários livres nos próximos dias.",
      409,
    );
  const chosen = scenarios.filter(
    (s) => !options.only?.length || options.only.includes(s.name),
  );
  const results: EvalResult[] = [];
  const queue = [...chosen];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const chat = new Chat(store, create, item.customer);
      try {
        await item.run(chat, shop);
      } catch (error) {
        chat.problems.push(
          `erro: ${error instanceof Error ? error.message.slice(0, 160) : "desconhecido"}`,
        );
      }
      results.push({
        name: item.name,
        ok: chat.problems.length === 0,
        problems: chat.problems,
        turns: chat.turns,
      });
    }
  };
  await Promise.all(
    Array.from({ length: options.concurrency ?? 4 }, () => worker()),
  );
  return chosen.map((s) => results.find((r) => r.name === s.name)!);
}
