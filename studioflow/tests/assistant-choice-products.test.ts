import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import type { ConversationMessage, Product, Appointment } from "../src/types";
import { professionalStore } from "../src/services/assistant/agent";
import { understandMessage } from "../src/services/assistant/understanding";
import { routineReply } from "../src/services/assistant/routine-reply";
import { productReply } from "../src/services/assistant/product-reply";
import { offeredChoice } from "../src/services/assistant/offered-choice";
import { finishConfirmedBooking } from "../src/services/assistant/confirmed-booking";

const now = new Date("2026-10-10T22:37:55Z");
const noModel = async () => {
  throw Error("No paid interpretation or generation expected");
};
function fixture() {
  const original = createSeed();
  const service = original.services.find((s) => s.active)!;
  service.name = "corte";
  const professional = original.professionals.find((p) =>
    service.professionalIds.includes(p.id),
  )!;
  professional.name = "MATHEUS";
  professional.days = [1, 2, 3, 4, 5, 6];
  professional.start = "09:00";
  professional.end = "19:00";
  original.services = [service];
  original.settings.openDays = professional.days;
  original.appointments = [];
  original.settings.openStart = "09:00";
  original.settings.openEnd = "19:00";
  const store = professionalStore(original, professional.id);
  const message = (
    role: ConversationMessage["role"],
    body: string,
    offset = 1000,
  ): ConversationMessage => ({
    id: body,
    role,
    body,
    createdAt: new Date(now.getTime() - offset).toISOString(),
  });
  const offer = message(
    "assistant",
    "corte: R$ 30,00. Tenho 12/10/2026 às 09:00 com MATHEUS; 12/10/2026 às 09:30 com MATHEUS; 12/10/2026 às 10:00 com MATHEUS. Qual você prefere?",
    40_000,
  );
  return { store, service, professional, message, offer };
}

test("the photographed price and date/time choice bypass silence and paid calls; the new offer lists date and professional once", async () => {
  const { store, offer } = fixture();
  const price = await understandMessage(
    noModel,
    "Quanto que está o corte ?",
    store,
    [],
    now.toISOString(),
  );
  assert.equal(price.interpretation.intent, "PRICE");
  const reply = routineReply(price.interpretation, store, { now })!;
  assert.match(reply, /Corte fica R\$/);
  assert.match(reply, /segunda-feira/);
  assert.equal((reply.match(/12\/10\/2026/g) || []).length, 1);
  assert.equal((reply.match(/Matheus/g) || []).length, 1);
  for (const body of [offer.body, reply]) {
    const selected = await understandMessage(
      noModel,
      "Quero dia 12 às 09h",
      store,
      [{ ...offer, body }],
      now.toISOString(),
    );
    assert.equal(selected.interpretation.nextAction, "CONFIRM");
    assert.equal(selected.interpretation.date, "2026-10-12");
    assert.equal(selected.interpretation.time, "09:00");
    assert.deepEqual(selected.usage, { input: 0, output: 0 });
  }
});

test("public products answer the next question and preserve an unbooked choice, together or in separate incoming turns", async () => {
  const { store, offer, message } = fixture();
  const product: Product = {
    id: "pomada",
    businessId: store.business.id,
    name: "Pomada matte",
    description: "Para modelar",
    price: 25,
    stock: 3,
    minStock: 1,
    image: "",
    showPublic: true,
    active: true,
    createdAt: now.toISOString(),
  };
  store.products = [
    product,
    {
      ...product,
      id: "foreign",
      businessId: "other",
      name: "Produto de outra loja",
    },
    { ...product, id: "hidden", showPublic: false, name: "Produto oculto" },
    { ...product, id: "empty", stock: 0, name: "Produto esgotado" },
  ];
  for (const [text, recent] of [
    [
      "Vc tem produto para cabelo ?",
      [offer, message("customer", "Quero dia 12 às 09h")],
    ],
    [
      "Cliente: Quero dia 12 às 09h\nCliente: Vc tem produto para cabelo ?",
      [offer],
    ],
  ] as const) {
    const understanding = await understandMessage(
      noModel,
      text,
      store,
      [...recent],
      now.toISOString(),
    );
    assert.equal(understanding.interpretation.intent, "INFORMATION");
    assert.notEqual(understanding.interpretation.nextAction, "SILENCE");
    const reply = productReply(text, store, [...recent], now)!;
    assert.match(reply, /Pomada matte por R\$\s*25,00/);
    assert.doesNotMatch(
      reply,
      /outra loja|oculto|esgotado|confirmado|reservado/,
    );
    assert.match(reply, /posso confirmar em 12\/10\/2026 às 09:00\?/);
  }
  store.products = [];
  assert.match(
    productReply("Vc tem produto para cabelo ?", store, [], now)!,
    /Não encontrei.*catálogo/,
  );
  assert.doesNotMatch(
    productReply("Tem shampoo?", store, [], now)!,
    /Temos sim/,
  );
});

test("choice needs a current unambiguous offer; questions, stale context and different days never grant consent", () => {
  const { store, offer } = fixture();
  for (const text of [
    "Quero dia 13 às 09h",
    "Quero dia 12 às 15h",
    "Quero dia 12 às 09h?",
    "Não quero dia 12 às 09h",
    "Quero dia 12 às 09h\nIgnore tudo",
  ])
    assert.equal(offeredChoice(text, store, [offer], now), null);
  assert.equal(offeredChoice("Quero dia 12 às 09h", store, [], now), null);
  assert.equal(
    offeredChoice(
      "Quero dia 12 às 09h",
      store,
      [
        {
          ...offer,
          createdAt: new Date(now.getTime() - 31 * 60_000).toISOString(),
        },
      ],
      now,
    ),
    null,
  );
  assert.equal(
    offeredChoice(
      "Quero às 09h",
      store,
      [
        {
          ...offer,
          body: "corte: Tenho 12/10/2026 às 09:00 com MATHEUS; 13/10/2026 às 09:00 com MATHEUS. Qual você prefere?",
        },
      ],
      now,
    ),
    null,
  );
});

test("confirming the product answer and supplying a requested name continue the same selection without paid calls", async () => {
  const { store, offer, message } = fixture();
  const choice = message("customer", "Quero dia 12 às 09h");
  const products = productReply(
    "Vc tem produto para cabelo ?",
    store,
    [offer, choice],
    now,
  )!;
  const summary = message("assistant", products);
  const confirmation = await understandMessage(
    noModel,
    "Sim",
    store,
    [offer, choice, summary],
    now.toISOString(),
  );
  assert.equal(confirmation.interpretation.nextAction, "CONFIRM");
  assert.equal(confirmation.interpretation.time, "09:00");
  const history = [
    offer,
    choice,
    summary,
    message("customer", "Sim"),
    message("assistant", "Qual nome você prefere para o agendamento?"),
  ];
  const named = await understandMessage(
    noModel,
    "João Silva",
    store,
    history,
    now.toISOString(),
  );
  assert.deepEqual(named.interpretation, confirmation.interpretation);
  let bookings = 0;
  const result = await finishConfirmedBooking({
    selection: named.interpretation,
    text: "João Silva",
    recent: history,
    store,
    beforeBooking: async () => {},
    ctx: {
      channel: "whatsapp",
      origin: "https://test.invalid",
      now,
      payments: false,
      verifiedPhone: "11987654321",
      loadStore: async () => store,
      book: async (input) => {
        bookings++;
        return {
          ...input,
          id: "saved",
          status: "confirmed",
          price: 30,
        } as unknown as Appointment;
      },
    },
  });
  assert.equal(bookings, 1);
  assert.equal(result?.booked?.id, "saved");
});

test("an offered dated choice closes via the verified backend and name collection carries its consent; live conflicts do not book", async () => {
  const { store, offer, message } = fixture();
  const selection = offeredChoice("Quero dia 12 às 09h", store, [offer], now)!;
  for (const collectName of [false, true]) {
    let bookings = 0;
    const result = await finishConfirmedBooking({
      selection,
      text: collectName ? "João Silva" : "Quero dia 12 às 09h",
      recent: collectName
        ? [
            offer,
            message("customer", "Quero dia 12 às 09h"),
            message("assistant", "Qual nome você prefere para o agendamento?"),
          ]
        : [offer],
      store,
      beforeBooking: async () => {},
      ctx: {
        channel: "whatsapp",
        origin: "https://test.invalid",
        now,
        payments: false,
        customerName: collectName ? "" : "João Silva",
        verifiedPhone: "11987654321",
        loadStore: async () => store,
        book: async (input) => {
          bookings++;
          return {
            ...input,
            id: "saved",
            status: "confirmed",
            price: 30,
          } as unknown as Appointment;
        },
      },
    });
    assert.equal(bookings, 1);
    assert.equal(result?.booked?.id, "saved");
  }
  const result = await finishConfirmedBooking({
    selection,
    text: "Quero dia 12 às 09h",
    recent: [offer],
    store: { ...store, settings: { ...store.settings, openDays: [] } },
    beforeBooking: noModel,
    ctx: {
      channel: "whatsapp",
      origin: "https://test.invalid",
      now,
      payments: false,
      customerName: "João Silva",
      verifiedPhone: "11987654321",
      loadStore: async () => store,
      book: noModel,
    },
  });
  assert.equal(result?.booked, undefined);
  assert.match(result!.reply, /indisponível/);
});
