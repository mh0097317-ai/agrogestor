import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { availableSlots, localDate } from "../src/lib/availability";
import {
  readDemo,
  createDemoBusiness,
  mutateDemo,
} from "../src/services/server-demo";
import {
  processConversation,
  type Conversation,
  type ConversationRepo,
} from "../src/services/assistant/conversations";
import { changeRequest } from "../src/services/assistant/manage-booking";
import type { BookingMenu } from "../src/services/assistant/booking-menu";
import type { ConversationMessage } from "../src/types";

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
  const slug = `manage-${name}-${process.pid}`;
  const fixture = structuredClone(await readDemo("barber-011"));
  fixture.business.slug = slug;
  fixture.settings.assistantEnabled = true;
  fixture.settings.cancellationHours = 2;
  fixture.settings.minNotice = 0;
  fixture.settings.openDays = [0, 1, 2, 3, 4, 5, 6];
  const service = fixture.services.find((s) => s.active)!;
  service.name = "corte";
  fixture.services = [service];
  const pro = fixture.professionals.find((p) =>
    service.professionalIds.includes(p.id),
  )!;
  pro.days = [0, 1, 2, 3, 4, 5, 6];
  fixture.professionals = [pro];
  fixture.appointments = [];
  const day = localDate(new Date(Date.now() + 3 * 86400000));
  const slots = availableSlots(fixture, [service.id], pro.id, day);
  const [first, second] = [slots[0], slots.at(-1)!];
  const appointment = {
    id: randomUUID(),
    businessId: fixture.business.id,
    customerId: randomUUID(),
    customerName: "Gislayniel",
    customerPhone: "11987654321",
    customerEmail: "",
    professionalId: pro.id,
    serviceIds: [service.id],
    start: first.start,
    end: new Date(
      Date.parse(first.start) + service.duration * 60000,
    ).toISOString(),
    status: "confirmed",
    price: service.price,
    notes: "",
    createdAt: new Date().toISOString(),
  } as (typeof fixture.appointments)[number];
  fixture.appointments.push(appointment);
  await createDemoBusiness(fixture);
  const { repo, messages } = memoryRepo();
  const conversation = await repo.create({
    channel: "whatsapp",
    contactPhone: "11987654321",
    contactName: "Gislayniel",
  });
  const sent: { body: string; menu: BookingMenu | null | undefined }[] = [];
  const delivery = {
    slug,
    origin: "https://test.invalid",
    send: async (body: string, menu?: BookingMenu | null) => {
      sent.push({ body, menu });
    },
  };
  const say = async (body: string) => {
    await repo.addMessage(conversation.id, "customer", body);
    await processConversation(repo, conversation.id, delivery, async () => {
      throw Error("no model call expected");
    });
    return sent.at(-1)!;
  };
  const cleanup = () =>
    unlink(join(process.cwd(), ".data", `demo-${slug}.json`)).catch(() => {});
  return {
    slug,
    appointment,
    second,
    pro,
    say,
    cleanup,
    messages,
    conversation,
  };
}

test("recognizes cancel and reschedule requests", () => {
  assert.equal(changeRequest("Quero cancelar meu horário"), "cancel");
  assert.equal(changeRequest("Quero reagendar"), "reschedule");
  assert.equal(changeRequest("dá pra remarcar pra sexta?"), "reschedule");
  assert.equal(changeRequest("não quero cancelar"), null);
  assert.equal(changeRequest("quero marcar um corte"), null);
});

test("the customer cancels their own appointment after confirming", async () => {
  const t = await setup("cancel");
  try {
    const ask = await t.say("Quero cancelar meu horário");
    assert.match(ask.body, /Quer mesmo cancelar\?/);
    assert.ok(
      ask.menu?.rows.some((r) => r.id === `SF_CANCEL|${t.appointment.id}`),
    );
    assert.equal(
      (await readDemo(t.slug)).appointments[0].status,
      "confirmed",
      "asking does not cancel",
    );
    const done = await t.say("Sim");
    assert.match(done.body, /Pronto, cancelei/);
    assert.equal((await readDemo(t.slug)).appointments[0].status, "cancelled");
  } finally {
    await t.cleanup();
  }
});

test("'não' keeps the appointment", async () => {
  const t = await setup("keep");
  try {
    await t.say("preciso desmarcar");
    const kept = await t.say(`SF_KEEP|${t.appointment.id}`);
    assert.match(kept.body, /continua marcado/);
    assert.equal((await readDemo(t.slug)).appointments[0].status, "confirmed");
  } finally {
    await t.cleanup();
  }
});

test("reschedule moves the same appointment, never books a second one", async () => {
  const t = await setup("move");
  try {
    const ask = await t.say("Quero reagendar");
    assert.match(ask.body, /Para qual dia você quer mudar\?/);
    assert.ok(ask.menu?.rows.length);
    const date = localDate(new Date(t.second.start));
    const slot = `SF_SLOT|${date}|${t.second.time}|${t.pro.id}|${t.appointment.serviceIds[0]}`;
    const offer = await t.say(slot);
    assert.match(offer.body, /Posso confirmar/);
    const done = await t.say("Sim");
    assert.match(done.body, /remarcado/);
    const after = (await readDemo(t.slug)).appointments;
    assert.equal(after.length, 1);
    assert.equal(after[0].id, t.appointment.id);
    assert.equal(after[0].start, new Date(t.second.start).toISOString());
    assert.equal(after[0].status, "confirmed");
  } finally {
    await t.cleanup();
  }
});

test("too close to the time goes to the team", async () => {
  const t = await setup("late");
  try {
    await mutateDemo((store) => {
      store.appointments[0].start = new Date(
        Date.now() + 3600_000,
      ).toISOString();
    }, t.slug);
    const reply = await t.say("quero cancelar");
    assert.match(reply.body, /até 2 horas antes/);
    assert.equal((await readDemo(t.slug)).appointments[0].status, "confirmed");
  } finally {
    await t.cleanup();
  }
});
