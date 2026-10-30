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
import type { BookingMenu } from "../src/services/assistant/booking-menu";
import type { ConversationMessage } from "../src/types";

/*
 * The conversation a real owner tested on WhatsApp, tap by tap: service, day,
 * slot, name. It used to loop asking the name again and never booked.
 */
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
  return { repo };
}

async function setup(name: string, known = "") {
  const slug = `replay-${name}-${process.pid}`;
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
  fixture.customers = known
    ? [
        {
          id: randomUUID(),
          businessId: fixture.business.id,
          name: known,
          phone: "11912345678",
        } as (typeof fixture.customers)[number],
      ]
    : [];
  await createDemoBusiness(fixture);
  const { repo } = memoryRepo();
  const conversation = await repo.create({
    channel: "whatsapp",
    contactPhone: "11912345678",
    contactName: "",
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
    const before = sent.length;
    await repo.addMessage(conversation.id, "customer", body);
    await processConversation(repo, conversation.id, delivery, async () => {
      throw Error("no model call expected");
    });
    assert.equal(sent.length, before + 1, `one reply to "${body}"`);
    return sent.at(-1)!;
  };
  const cleanup = () =>
    unlink(join(process.cwd(), ".data", `demo-${slug}.json`)).catch(() => {});
  return { slug, service, pros, say, cleanup };
}

const tap = (menu: BookingMenu | null | undefined, title: RegExp) => {
  const row = menu?.rows.find((r) => title.test(r.title));
  assert.ok(row, `row ${title} in ${JSON.stringify(menu?.rows.map((r) => r.title))}`);
  return row.id;
};

test("tapping service, day and slot, then typing the name books it", async () => {
  const t = await setup("book");
  try {
    const day = localDate(new Date(Date.now() + 3 * 86400000));
    const pro = t.pros[1];
    const slot = availableSlots(
      await readDemo(t.slug),
      [t.service.id],
      pro.id,
      day,
    )[0];
    const services = await t.say(`Consultar horários para ${t.service.name}`);
    // The list matches the message: times of the day it describes.
    assert.ok(services.menu?.rows.some((r) => r.title === "Outros dias"));
    const days = await t.say(tap(services.menu, /^Outros dias$/));
    assert.match(days.body, /lista abaixo/);
    const dayRow = days.menu?.rows.find((r) =>
      r.id.endsWith(day.split("-").reverse().join("/")),
    );
    assert.ok(dayRow, "the day is in the list");
    const times = await t.say(dayRow.id);
    const slotId = `SF_SLOT|${day}|${slot.time}|${pro.id}|${t.service.id}`;
    assert.ok(times.menu?.rows.some((r) => r.id === slotId));
    const picked = await t.say(slotId);
    assert.match(picked.body, /Como você prefere ser chamado/);
    assert.equal(picked.menu, null, "no list while asking the name");
    const booked = await t.say("Me chama de dudu");
    assert.match(booked.body, /Agendamento confirmado|registrado/);
    const store = await readDemo(t.slug);
    assert.equal(store.appointments.length, 1);
    assert.equal(store.appointments[0].professionalId, pro.id);
    assert.equal(store.appointments[0].customerName.toLowerCase(), "dudu");
  } finally {
    await t.cleanup();
  }
});

test("a summary to approve comes with Confirmar, and Confirmar books", async () => {
  const t = await setup("confirm");
  try {
    const day = localDate(new Date(Date.now() + 3 * 86400000));
    const pro = t.pros[0];
    const slot = availableSlots(
      await readDemo(t.slug),
      [t.service.id],
      pro.id,
      day,
    )[1];
    await t.say(`SF_SLOT|${day}|${slot.time}|${pro.id}|${t.service.id}`);
    const ask = await t.say("Me chama de dudu");
    if (/Posso confirmar/.test(ask.body)) {
      assert.match(ask.body, new RegExp(pro.name.split(" ")[0], "i"));
      const done = await t.say(tap(ask.menu, /^Confirmar$/));
      assert.match(done.body, /Agendamento confirmado|registrado/);
    }
    const store = await readDemo(t.slug);
    assert.equal(store.appointments.length, 1);
    assert.equal(store.appointments[0].professionalId, pro.id);
  } finally {
    await t.cleanup();
  }
});

test("a known customer gets Confirmar right after tapping the slot", async () => {
  const t = await setup("known", "Eduardo Lima");
  try {
    const day = localDate(new Date(Date.now() + 2 * 86400000));
    const pro = t.pros[1];
    const slot = availableSlots(
      await readDemo(t.slug),
      [t.service.id],
      pro.id,
      day,
    )[0];
    const ask = await t.say(
      `SF_SLOT|${day}|${slot.time}|${pro.id}|${t.service.id}`,
    );
    assert.match(ask.body, /Posso confirmar esse horário em seu nome/);
    const done = await t.say(tap(ask.menu, /^Confirmar$/));
    assert.match(done.body, /Agendamento confirmado|registrado/);
    const store = await readDemo(t.slug);
    assert.equal(store.appointments.length, 1);
    assert.equal(store.appointments[0].professionalId, pro.id);
    assert.equal(store.appointments[0].customerName, "Eduardo Lima");
  } finally {
    await t.cleanup();
  }
});
