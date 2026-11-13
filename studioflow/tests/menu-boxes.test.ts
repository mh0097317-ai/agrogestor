import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  bookingMenu,
  menuEvent,
  menuSections,
  menuSelection,
  menuText,
  numberedPick,
  type BookingMenu,
} from "../src/services/assistant/booking-menu";
import type { Interpretation } from "../src/services/assistant/understanding";

const now = new Date("2026-10-28T10:00:00Z");
function fixture() {
  const store = createSeed();
  store.appointments = [];
  store.blockedTimes = [];
  store.settings.minNotice = 0;
  store.settings.maxDays = 60;
  store.settings.openDays = [0, 1, 2, 3, 4, 5, 6];
  store.professionals = store.professionals.filter((p) => p.active);
  for (const p of store.professionals) p.days = [0, 1, 2, 3, 4, 5, 6];
  return store;
}

test("caixinhas: serviços em blocos por categoria e horários por período", () => {
  const store = fixture();
  const services = bookingMenu(store, { intent: "BOOK", serviceIds: [] } as unknown as Interpretation, "quero agendar", now)!;
  const blocks = menuSections(services);
  assert.ok(blocks.length > 1, "catálogo dividido por categoria");
  assert.ok(blocks.every((b) => b.title.length <= 24 && b.rows.length));
  assert.equal(blocks.flatMap((b) => b.rows).length, services.rows.length);

  const service = store.services.find((s) => s.active)!;
  const dayRow = bookingMenu(store, menuSelection(store, `Consultar horários para ${service.name}`) as Interpretation, `Consultar ${service.name}: página 1 dos dias`, now)!.rows.find((r) => r.id.includes(" no dia "))!;
  const slots = bookingMenu(store, menuSelection(store, dayRow.id) as Interpretation, dayRow.id, now)!;
  const titles = menuSections(slots).map((b) => b.title);
  assert.ok(titles.some((t) => /Manhã|Tarde|Noite/.test(t)), titles.join());
  assert.equal(titles.at(-1), "Mais opções");
  // Mesmas linhas e mesmos ids: os blocos só organizam.
  assert.ok(slots.rows.filter((r) => r.id.startsWith("SF_SLOT")).length > 0);
});

test("caixinhas: boas-vindas e confirmação cabem nos limites do WhatsApp", () => {
  const store = fixture();
  const welcome = bookingMenu(store, undefined, "oi", now)!;
  assert.deepEqual(welcome.rows.map((r) => r.title), ["📅 Agendar horário", "💈 Serviços e preços", "💬 Falar com equipe"]);
  assert.ok(welcome.rows.every((r) => r.title.length <= 20), "cabem como botão (20)");
  assert.equal(menuSections(welcome).length, 1);
});

test("caixinhas: lista recusada vira menu numerado, e o número volta como a opção", () => {
  const menu: BookingMenu = {
    title: "Horários · qui, 29/10",
    button: "Escolher horário",
    rows: [
      { id: "a", title: "Lucas · 09:00", description: "Disponível", group: "☀️ Manhã" },
      { id: "b", title: "João · 14:30", description: "Disponível", group: "🌤️ Tarde" },
      { id: "c", title: "Outros dias", description: "Escolher outro dia", group: "Mais opções" },
    ],
  };
  const text = menuText("Separei os horários de quinta.", menu);
  assert.match(text, /^Separei os horários de quinta\./);
  assert.match(text, /1️⃣ \*Lucas · 09:00\*/);
  assert.match(text, /_🌤️ Tarde_\n2️⃣ \*João · 14:30\*/);
  assert.match(text, /3️⃣ \*Outros dias\*/);
  assert.match(text, /Responda com o \*número\*/);

  const event = menuEvent(menu);
  assert.equal(numberedPick("2", event), '[Respondeu 2 na lista "Horários · qui, 29/10"] João · 14:30');
  assert.match(numberedPick("opção 1", event)!, /Lucas · 09:00$/);
  assert.match(numberedPick("quero a 3", event)!, /Outros dias$/);
  // Fora da lista, sem lista antes, ou conversa normal: passa como veio.
  assert.equal(numberedPick("7", event), null);
  assert.equal(numberedPick("2", "Horário marcado pela atendente virtual."), null);
  assert.equal(numberedPick("2", undefined), null);
  assert.equal(numberedPick("quero 2 cortes amanhã", event), null);
  assert.equal(numberedPick("14:30", event), null);
});

test("caixinhas: título de serviço com ponto e vírgula não quebra a volta pelo número", () => {
  const menu: BookingMenu = { title: "Serviços", button: "Ver", rows: [
    { id: "a", title: "Corte; barba", description: "" },
    { id: "b", title: "Sobrancelha", description: "" },
  ] };
  assert.match(numberedPick("2", menuEvent(menu))!, /Sobrancelha$/);
  assert.match(numberedPick("1", menuEvent(menu))!, /Corte; barba$/);
});
