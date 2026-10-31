import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  bookingMenu,
  menuChoiceReply,
  menuPageReply,
  menuSelection,
  whatsappText,
} from "../src/services/assistant/booking-menu";
import { understandMessage } from "../src/services/assistant/understanding";
import { unverifiedBookingClaim } from "../src/services/assistant/reply-validation";
import { welcomeReply } from "../src/services/assistant/welcome-reply";
import type { CreateMessage } from "../src/services/assistant/agent";
import type { Interpretation } from "../src/services/assistant/understanding";

const now = new Date("2026-10-28T23:00:00Z");
function fixture() {
  const store = createSeed();
  store.appointments = [];
  store.blockedTimes = [];
  store.settings.minNotice = 0;
  store.settings.maxDays = 60;
  store.settings.openDays = [0, 1, 2, 3, 4, 5, 6];
  store.professionals = store.professionals.filter((p) => p.active);
  for (const p of store.professionals) p.days = [0, 1, 2, 3, 4, 5, 6];
  const service = store.services.find((s) => s.active)!;
  return { store, service };
}
const rowsFor = (store: ReturnType<typeof fixture>["store"], text: string) =>
  bookingMenu(store, menuSelection(store, text) as Interpretation, text, now)
    ?.rows || [];

test("every row of the WhatsApp lists is read without the model", async () => {
  const { store, service } = fixture();
  const noModel = (async () => {
    throw new Error("model called");
  }) as unknown as CreateMessage;
  const day = `Consultar horários para ${service.name}`;
  assert.equal(menuSelection(store, day)?.intent, "AVAILABILITY");
  const days = rowsFor(store, day);
  const dayRow = days.find((r) => r.id.includes(" no dia "))!;
  const picked = menuSelection(store, dayRow.id)!;
  assert.match(picked.date, /^\d{4}-\d{2}-\d{2}$/);
  const slots = rowsFor(store, dayRow.id);
  const more = slots.find((r) => r.title === "Mais horários");
  assert.ok(more, "the day has a second page");
  const second = rowsFor(store, more.id);
  const first = slots.filter((r) => r.id.startsWith("SF_SLOT"));
  assert.ok(second.length);
  assert.ok(
    second.every((r) => !first.some((f) => f.id === r.id)),
    "page 2 shows other times",
  );
  assert.ok(menuPageReply(more.id));
  const slot = second.find((r) => r.id.startsWith("SF_SLOT"))!;
  const understood = await understandMessage(noModel, slot.id, store, []);
  assert.equal(understood.interpretation.intent, "BOOK");
  assert.equal(understood.usage.input, 0);
  const reply = menuChoiceReply(
    store,
    understood.interpretation,
    slot.id,
    "Ana",
    now,
  );
  assert.match(reply || "", /Essa opção está livre/);
  assert.match(reply || "", /Posso confirmar/);
});

test("a slot row with a period suffix still resolves", () => {
  const { store, service } = fixture();
  const text = `Consultar horários para ${service.name} no dia 30/10/2026 à tarde`;
  const slot = rowsFor(store, text).find((r) => r.id.startsWith("SF_SLOT"))!;
  assert.match(slot.id, / à tarde$/);
  assert.equal(menuSelection(store, slot.id)?.intent, "BOOK");
  assert.match(
    menuChoiceReply(
      store,
      menuSelection(store, slot.id)!,
      slot.id,
      "Ana",
      now,
    ) || "",
    /Essa opção está livre/,
  );
});

test("unknown rows and forged ids fall back to the model", () => {
  const { store } = fixture();
  assert.equal(menuSelection(store, "Consultar horários para pizza"), null);
  assert.equal(
    menuSelection(store, "SF_SLOT|2026-10-30|12:30|nope|nope"),
    null,
  );
  assert.equal(menuSelection(store, "Oi, tudo bem?"), null);
});

test("a claimed booking without a booking is caught", () => {
  assert.ok(
    unverifiedBookingClaim(
      "Perfeito! Seu corte foi agendado para **quinta-feira, 29 de outubro, às 09:00**.",
    ),
  );
  assert.ok(!unverifiedBookingClaim("Seu corte ainda não foi agendado."));
});

test("WhatsApp text uses single asterisks and no double greeting", () => {
  assert.equal(whatsappText("Seu **corte** às 9h"), "Seu *corte* às 9h");
  assert.equal(welcomeReply("Olá! Tudo bem?", [], "Oi", now), "Olá! Tudo bem?");
});

test("the name answer drops 'sou'", async () => {
  const { nameAnswer } =
    await import("../src/services/assistant/understanding");
  const asked = [
    {
      id: "1",
      role: "assistant",
      body: "Como você prefere ser chamado?",
      createdAt: now.toISOString(),
    },
  ] as Parameters<typeof nameAnswer>[1];
  assert.equal(nameAnswer("Sou Gislayniel", asked), "Gislayniel");
  assert.equal(nameAnswer("Me chamo Ana Paula", asked), "Ana Paula");
});

test("reminders greet the real first name and write names normally", async () => {
  const { customerReminder } =
    await import("../src/services/whatsapp/reminders");
  const { store, service } = fixture();
  const pro = store.professionals[0];
  pro.name = "MATHEUS";
  const text = customerReminder(
    store,
    {
      ...store.appointments[0],
      ...{
        id: "a1",
        customerName: "Sou Gislayniel",
        serviceIds: [service.id],
        professionalId: pro.id,
        start: "2026-10-29T21:00:00Z",
      },
    } as Parameters<typeof customerReminder>[1],
    720,
  );
  assert.match(text, /^Oi, Gislayniel!/);
  assert.match(text, /com Matheus\b/);
});

test("the text says more times are in the list", async () => {
  const { availabilityReply } =
    await import("../src/services/assistant/availability-reply");
  const { store, service } = fixture();
  const reply = availabilityReply(
    {
      intent: "AVAILABILITY",
      stage: "CHOOSING_TIME",
      confidence: 1,
      serviceIds: [service.id],
      professionalId: "",
      date: "2026-10-30",
      time: "",
      missing: [],
      nextAction: "CONSULT",
    },
    store,
    `Consultar horários para ${service.name} no dia 30/10/2026`,
    [],
    now,
  );
  assert.match(reply || "", /e mais \d+ horários/);
  assert.match(reply || "", /lista abaixo/);
});

test("a second unreadable media goes to the team instead of repeating", async () => {
  const { generalReply } =
    await import("../src/services/assistant/general-reply");
  const { store } = fixture();
  const noModel = (async () => {
    throw new Error("model called");
  }) as unknown as CreateMessage;
  const first = await generalReply(
    noModel,
    "[O cliente enviou um áudio.]",
    store,
    [],
    now,
  );
  assert.match(first.reply, /Não consegui ler/);
  const second = await generalReply(
    noModel,
    "[O cliente enviou um áudio.]",
    store,
    [
      {
        id: "a",
        role: "assistant",
        body: first.reply,
        createdAt: new Date(now.getTime() - 60_000).toISOString(),
      },
    ],
    now,
  );
  assert.ok(second.handoff);
  assert.doesNotMatch(second.reply, /Não consegui ler/);
});

test("the assistant greets back, then answers only about the business", async () => {
  const { assistantMayAnswer, pureGreeting } =
    await import("../src/services/assistant/contact-scope");
  const { store, service } = fixture();
  const at = (minutes: number) =>
    new Date(now.getTime() - minutes * 60_000).toISOString();
  const may = (
    text: string,
    messages: Parameters<typeof assistantMayAnswer>[0]["messages"] = [],
  ) => assistantMayAnswer({ text, store: async () => store, messages, now });
  const staffChat = [
    { id: "1", role: "staff" as const, body: "terminei la", createdAt: at(90) },
  ];
  const greeted = [
    ...staffChat,
    {
      id: "2",
      role: "assistant" as const,
      body: "Boa noite! Tudo bem?",
      createdAt: at(1),
    },
  ];
  assert.ok(pureGreeting("Boa noite! Tudo bem?"));
  assert.ok(!pureGreeting("Boa noite! Tudo bem? Qual serviço você quer?"));
  // Greetings always get a greeting back.
  assert.ok(await may("Boa noite", staffChat));
  assert.ok(await may("Oi, tudo bem?", staffChat));
  // After the greeting: small talk once, business always, the rest silent.
  assert.ok(await may("Tudo ótimo, e você?", greeted));
  assert.ok(await may("Quanto custa o corte?", greeted));
  assert.ok(await may("tem horário amanhã?", greeted));
  assert.equal(await may("Ok meu filho", greeted), false);
  assert.equal(await may("agorinha ligo para te explicar", greeted), false);
  assert.equal(await may("OK", staffChat), false);
  assert.equal(await may("ta otimo", staffChat), false);
  assert.ok(await may(`Consultar horários para ${service.name}`, staffChat));
  for (const text of ["Dá pra marcar pra sábado?", "vocês atendem hoje?"])
    assert.ok(await may(text, staffChat), text);
  // Mid-flow answers to a business question keep going.
  assert.ok(
    await may("sim", [
      ...staffChat,
      {
        id: "3",
        role: "assistant" as const,
        body: "Posso confirmar esse horário em seu nome?",
        createdAt: at(2),
      },
    ]),
  );
});
