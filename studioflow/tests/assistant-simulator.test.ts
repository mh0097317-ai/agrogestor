import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { availableSlots, localDate } from "../src/lib/availability";
import { createDemoBusiness, readDemo } from "../src/services/server-demo";
import { simulateWhatsApp } from "../src/services/assistant/simulator";
import type { ConversationMessage } from "../src/types";

async function setup(name: string) {
  const slug = `simulator-${name}-${process.pid}`;
  const fixture = structuredClone(await readDemo("barber-011"));
  fixture.business.slug = slug;
  fixture.settings.assistantEnabled = false;
  fixture.settings.cancellationHours = 2;
  fixture.settings.minNotice = 0;
  fixture.settings.openDays = [0, 1, 2, 3, 4, 5, 6];
  const service = fixture.services.find((s) => s.active)!;
  fixture.services = [service];
  const pro = fixture.professionals.find((p) =>
    service.professionalIds.includes(p.id),
  )!;
  pro.days = [0, 1, 2, 3, 4, 5, 6];
  fixture.professionals = [pro];
  fixture.appointments = [];
  const day = localDate(new Date(Date.now() + 3 * 86400000));
  const [slot] = availableSlots(fixture, [service.id], pro.id, day);
  const appointment = {
    id: randomUUID(),
    businessId: fixture.business.id,
    customerId: randomUUID(),
    customerName: "Gislayniel",
    customerPhone: "11987654321",
    customerEmail: "",
    reminder: true,
    professionalId: pro.id,
    serviceIds: [service.id],
    start: slot.start,
    end: new Date(
      Date.parse(slot.start) + service.duration * 60000,
    ).toISOString(),
    status: "confirmed",
    price: service.price,
    notes: "",
    createdAt: new Date().toISOString(),
  } as (typeof fixture.appointments)[number];
  fixture.appointments.push(appointment);
  await createDemoBusiness(fixture);
  let messages: ConversationMessage[] = [];
  let history: never[] = [];
  let turns = 0;
  const say = async (text: string, phone = "11987654321") => {
    const turn = await simulateWhatsApp({
      businessId: fixture.business.id,
      slug,
      origin: "https://test.invalid",
      phone,
      name: "Cliente de teste",
      text,
      messages,
      history,
      create: null,
      store: () => readDemo(slug),
      takeTurn: async () => (turns++, true),
      addTokens: async () => undefined,
    });
    messages = turn.messages;
    history = turn.history as never[];
    return turn;
  };
  const cleanup = async () => {
    for (const file of [`demo-${slug}.json`, `business-${slug}.json`])
      await unlink(join(process.cwd(), ".data", file)).catch(() => {});
  };
  return { slug, appointment, say, cleanup, turns: () => turns };
}

test("the test chat cancels like WhatsApp but leaves the agenda untouched", async () => {
  const t = await setup("cancel");
  try {
    const ask = await t.say("Quero cancelar meu horário");
    assert.match(ask.replies[0].body, /Quer mesmo cancelar\?/);
    assert.ok(
      ask.replies[0].menu?.rows.some(
        (r) => r.id === `SF_CANCEL|${t.appointment.id}`,
      ),
    );
    const done = await t.say("Sim");
    assert.match(done.replies[0].body, /Pronto, cancelei/);
    assert.equal(
      (await readDemo(t.slug)).appointments[0].status,
      "confirmed",
      "a simulation never cancels the real appointment",
    );
    // The transcript carries over between turns.
    assert.equal(done.messages.filter((m) => m.role === "customer").length, 2);
  } finally {
    await t.cleanup();
  }
});

test("a message that is not about the shop gets no reply, with a note why", async () => {
  const t = await setup("silent");
  try {
    const turn = await t.say("Você viu o jogo ontem?");
    assert.equal(turn.replies.length, 0);
    assert.match(turn.notes[0], /só responde mensagens sobre a barbearia/);
    assert.equal(t.turns(), 0, "no AI turn is spent on it");
  } finally {
    await t.cleanup();
  }
});

test("without an AI key the test chat says the team would take over", async () => {
  const t = await setup("nokey");
  try {
    const turn = await t.say("Quanto custa o corte?", "11000000000");
    assert.equal(turn.replies.length, 0);
    assert.equal(turn.status, "human");
    assert.ok(turn.notes.some((n) => /sem chave de IA/.test(n)));
  } finally {
    await t.cleanup();
  }
});
