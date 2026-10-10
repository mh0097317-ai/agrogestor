import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { availableSlots } from "../src/lib/availability";
import { finishConfirmedBooking } from "../src/services/assistant/confirmed-booking";
import type { Interpretation } from "../src/services/assistant/understanding";
import type { Appointment, ConversationMessage } from "../src/types";

const store = createSeed();
const now = new Date("2026-10-09T12:00:00Z");
const ids = [store.services[0].id];
const slot = availableSlots(store, ids, "any", "2026-10-10", now)[0];
const selection: Interpretation = {
  intent: "BOOK",
  stage: "CONFIRMING",
  confidence: 0.98,
  serviceIds: ids,
  professionalId: slot.professionalId,
  date: "2026-10-10",
  time: slot.time,
  missing: [],
  nextAction: "CONFIRM",
};

test("confirmed WhatsApp choice books with verified phone and emits only the persisted receipt", async () => {
  const order: string[] = [];
  const result = await finishConfirmedBooking({
    selection,
    text: "Pode marcar",
    recent: [],
    store,
    beforeBooking: async () => {
      order.push("persist-boundary");
    },
    ctx: {
      channel: "whatsapp",
      origin: "https://app.test",
      customerName: "Cliente Teste",
      verifiedPhone: "11987654321",
      payments: false,
      now,
      loadStore: async () => store,
      book: async (input) => {
        order.push("book");
        assert.equal(input.phone, "11987654321");
        assert.equal(input.start, slot.start);
        return {
          id: "saved",
          ...input,
          serviceIds: ids,
          price: 30,
          status: "confirmed",
          token: "receipt",
        } as unknown as Appointment;
      },
    },
  });
  assert.deepEqual(order, ["persist-boundary", "book"]);
  assert.equal(result?.booked?.id, "saved");
  assert.match(result!.reply, /https:\/\/app.test\/booking\/receipt/);
});

test("questions, refusal, incomplete selection and unverified contact never mutate", async () => {
  for (const text of [
    "Não pode marcar",
    "Pode marcar?",
    "Talvez",
    "Só queria saber",
  ]) {
    const result = await finishConfirmedBooking({
      selection,
      text,
      recent: [],
      store,
      beforeBooking: async () => {
        throw Error("must not mutate");
      },
      ctx: {
        channel: "whatsapp",
        origin: "https://app.test",
        payments: false,
        now,
        customerName: "Teste",
        verifiedPhone: "11987654321",
        loadStore: async () => store,
        book: async () => {
          throw Error("must not book");
        },
      },
    });
    assert.equal(result?.booked, undefined);
  }
});

test("booking failure is handed to team without confirming or retrying", async () => {
  let count = 0;
  const result = await finishConfirmedBooking({
    selection,
    text: "Pode marcar",
    recent: [],
    store,
    beforeBooking: async () => {},
    ctx: {
      channel: "whatsapp",
      origin: "https://app.test",
      customerName: "Cliente Teste",
      verifiedPhone: "11987654321",
      payments: false,
      now,
      loadStore: async () => store,
      book: async () => {
        count++;
        throw Error("unknown mutation outcome");
      },
    },
  });
  assert.equal(count, 1);
  assert.ok(result?.handoff);
  assert.equal(result?.booked, undefined);
  assert.doesNotMatch(result!.reply, /Agendamento confirmado/);
});

test("a padded selected time is consent, but stale or revoked consent cannot survive name collection", async () => {
  const message = (
    role: ConversationMessage["role"],
    body: string,
  ): ConversationMessage => ({
    id: body,
    role,
    body,
    createdAt: new Date(now.getTime() - 1000).toISOString(),
  });
  const refused = [
    message("customer", "Pode marcar"),
    message("assistant", "Qual nome você prefere para o agendamento?"),
    message("customer", "Não quero mais"),
    message("assistant", "Qual nome você prefere para o agendamento?"),
  ];
  const stale = [
    {
      ...message("customer", "Pode marcar"),
      createdAt: new Date(now.getTime() - 31 * 60_000).toISOString(),
    },
    message("assistant", "Qual nome você prefere para o agendamento?"),
  ];
  for (const recent of [refused, stale]) {
    const result = await finishConfirmedBooking({
      selection,
      text: "João Silva",
      recent,
      store,
      beforeBooking: async () => {
        throw Error("must not mutate");
      },
      ctx: {
        channel: "whatsapp",
        origin: "https://app.test",
        payments: false,
        now,
        verifiedPhone: "11987654321",
        loadStore: async () => store,
        book: async () => {
          throw Error("must not book");
        },
      },
    });
    assert.equal(result?.booked, undefined);
    assert.match(result!.reply, /Posso confirmar/);
  }
  let bookings = 0;
  const result = await finishConfirmedBooking({
    selection,
    text: `${selection.time} por favor`,
    recent: [],
    store,
    beforeBooking: async () => {},
    ctx: {
      channel: "whatsapp",
      origin: "https://app.test",
      payments: false,
      now,
      customerName: "João Silva",
      verifiedPhone: "11987654321",
      loadStore: async () => store,
      book: async (input) => {
        bookings++;
        return {
          ...input,
          id: "new",
          price: 30,
          status: "confirmed",
        } as unknown as Appointment;
      },
    },
  });
  assert.equal(bookings, 1);
  assert.equal(result?.booked?.id, "new");
});

test("missing fields, missing verified phone and future consent summaries fail without booking", async () => {
  const context = {
    channel: "whatsapp" as const,
    origin: "https://app.test",
    payments: false,
    now,
    customerName: "João Silva",
    loadStore: async () => store,
    book: async () => {
      throw Error("must not book");
    },
  };
  const incomplete = await finishConfirmedBooking({
    selection: { ...selection, missing: ["date"] },
    text: "Pode marcar",
    recent: [],
    store,
    beforeBooking: async () => {
      throw Error("must not mutate");
    },
    ctx: { ...context, verifiedPhone: "11987654321" },
  });
  assert.equal(incomplete, null);
  const missingPhone = await finishConfirmedBooking({
    selection,
    text: "Pode marcar",
    recent: [],
    store,
    beforeBooking: async () => {
      throw Error("must not mutate");
    },
    ctx: context,
  });
  assert.ok(missingPhone?.handoff);
  const future = await finishConfirmedBooking({
    selection,
    text: "sim",
    recent: [
      {
        id: "future",
        role: "assistant",
        body: `Posso confirmar em 10/10/2026 às ${selection.time}?`,
        createdAt: new Date(now.getTime() + 1000).toISOString(),
      },
    ],
    store,
    beforeBooking: async () => {
      throw Error("must not mutate");
    },
    ctx: { ...context, verifiedPhone: "11987654321" },
  });
  assert.equal(future?.booked, undefined);
});
