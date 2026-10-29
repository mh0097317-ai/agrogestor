import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  availableSlots,
  availableSlotsByProfessional,
} from "../src/lib/availability";
import {
  bookingMenu,
  menuChoiceReply,
} from "../src/services/assistant/booking-menu";
import { offeredChoice } from "../src/services/assistant/offered-choice";
import { interactiveSelection } from "../src/services/whatsapp/evolution";
import type { Interpretation } from "../src/services/assistant/understanding";

const now = new Date("2026-10-14T11:00:00Z");
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
  const pro = store.professionals.find((p) =>
    service.professionalIds.includes(p.id),
  )!;
  const selected = {
    intent: "AVAILABILITY",
    confidence: 1,
    nextAction: "CONSULT",
    serviceIds: [service.id],
    professionalId: pro.id,
    date: "2026-10-15",
    missing: ["time"],
  } as Interpretation;
  return { store, service, pro, selected };
}
test("WhatsApp menu offers live dates, professionals and times, never foreign services", () => {
  const { store, service, pro, selected } = fixture();
  assert.ok(
    bookingMenu(store, undefined, "Oi", now)?.rows.some(
      (r) => r.id === "Quero agendar um horário",
    ),
  );
  const welcome = bookingMenu(store, undefined, "Boa noite, tudo bem?", now);
  assert.equal(welcome?.forceList, true);
  assert.deepEqual(
    welcome?.rows.map((row) => row.title),
    ["Agendar horário", "Serviços e preços", "Falar com a equipe"],
  );
  assert.ok(
    bookingMenu(
      store,
      { ...selected, date: "" },
      "Quero consultar horários",
      now,
    )?.rows.length,
  );
  assert.ok(
    bookingMenu(
      store,
      { ...selected, professionalId: "any" },
      "Quero consultar horários",
      now,
    )?.rows.some((r) => r.id.startsWith("SF_SLOT|")),
  );
  const list = bookingMenu(store, selected, "Consultar horários", now)!;
  assert.ok(list.rows.length <= 10);
  const slots = availableSlots(store, [service.id], pro.id, selected.date, now);
  assert.ok(list.rows.some((r) => r.title.includes(slots[0].time)));
  assert.equal(
    bookingMenu(
      store,
      { ...selected, serviceIds: ["outside-business"] },
      "Consultar horários",
      now,
    ),
    null,
  );
});
test("a price offer opens live barber and time options on a verified proposed day without booking", () => {
  const { store, selected } = fixture();
  const menu = bookingMenu(
    store,
    {
      ...selected,
      intent: "PRICE",
      nextAction: "ANSWER",
      date: "",
      professionalId: "any",
    },
    "Quanto custa?",
    now,
  );
  assert.ok(menu);
  assert.equal(menu.button, "Escolher horário");
  assert.ok(menu.rows.some((row) => row.id.startsWith("SF_SLOT|")));
  assert.ok(menu.rows.every((row) => !row.id.includes("Confirmar")));
});

test("professionals sharing a free time each appear in the menu, excluding other businesses", () => {
  const { store, service, selected } = fixture();
  const people = store.professionals.filter(
    (p) => p.businessId === store.business.id,
  );
  service.professionalIds = people.map((p) => p.id);
  store.professionals.push({
    ...people[0],
    id: "foreign-pro",
    businessId: "foreign",
    name: "Foreign",
  });
  service.professionalIds.push("foreign-pro");
  const menu = bookingMenu(
    store,
    { ...selected, professionalId: "any" },
    "Consultar horários",
    now,
  )!;
  for (const person of people)
    assert.ok(
      menu.rows.some((row) =>
        row.title.toLowerCase().includes(person.name.toLowerCase().slice(0, 8)),
      ),
    );
  assert.ok(menu.rows.every((row) => !row.title.includes("Foreign")));
});

test("one menu combines each available professional and time and safely reviews the selected slot", () => {
  const { store, service, pro, selected } = fixture();
  const people = store.professionals.filter(
    (p) => p.businessId === store.business.id && p.active,
  );
  service.professionalIds = people.map((p) => p.id);
  const menu = bookingMenu(
    store,
    { ...selected, professionalId: "any" },
    "Quero consultar horários",
    now,
  )!;
  const slotRows = menu.rows.filter((row) => row.id.startsWith("SF_SLOT|"));
  assert.equal(menu.title.startsWith("Horários"), true);
  assert.equal(menu.button, "Escolher horário");
  assert.ok(slotRows.length > 1);
  assert.ok(slotRows.every((row) => row.description.includes("Disponível")));
  const offeredTimes = slotRows.map((row) => row.title.match(/\d{2}:\d{2}$/)?.[0]);
  assert.deepEqual(
    offeredTimes,
    [...offeredTimes].sort((a, b) => (a || "").localeCompare(b || "")),
    "all barbers' choices stay in chronological order",
  );

  const response = menuChoiceReply(
    store,
    { ...selected, professionalId: "any" },
    slotRows[0].id,
    "Ana",
    now,
  );
  assert.match(response || "", /Posso confirmar esse horário/);
  assert.match(response || "", new RegExp(pro.name, "i"));
  assert.ok(
    availableSlotsByProfessional(store, [service.id], selected.date, now)
      .length > 0,
  );
});

test("menu selection is reviewed against current availability and asks for confirmation", () => {
  const { store, service, pro, selected } = fixture();
  const menu = bookingMenu(store, selected, "Consultar horários", now)!;
  const row = menu.rows.find((r) => r.id.startsWith("Consultar a opção:"))!;
  assert.match(
    menuChoiceReply(store, selected, row.id, "Ana", now)!,
    /Posso confirmar/,
  );
  const slot = availableSlots(
    store,
    [service.id],
    pro.id,
    selected.date,
    now,
  ).find((s) => s.time === row.title)!;
  const seed = createSeed().appointments[0];
  store.appointments = [
    {
      ...seed,
      id: "occupied",
      businessId: store.business.id,
      professionalId: pro.id,
      serviceIds: [service.id],
      status: "confirmed",
      start: slot.start,
      end: new Date(
        Date.parse(slot.start) + service.duration * 60000,
      ).toISOString(),
    },
  ];
  assert.match(
    menuChoiceReply(store, selected, row.id, "Ana", now)!,
    /não está mais disponível/,
  );
});

test("affirmative confirmation keeps the selected slot instead of asking for date and time again", () => {
  const { store, service, pro, selected } = fixture();
  const menu = bookingMenu(store, selected, "Consultar horários", now)!;
  const row = menu.rows.find((item) => item.id.startsWith("Consultar a opção:"))!;
  const reply = menuChoiceReply(store, selected, row.id, "Ana", now)!;
  const recent = [
    {
      id: "selection",
      role: "customer" as const,
      body: row.id,
      createdAt: new Date(now.getTime() - 2_000).toISOString(),
    },
    {
      id: "confirmation",
      role: "assistant" as const,
      body: reply,
      createdAt: new Date(now.getTime() - 1_000).toISOString(),
    },
  ];

  assert.match(reply, /\d{2}\/\d{2}\/\d{4}/);
  const choice = offeredChoice("Sim", store, recent, now);
  assert.ok(choice);
  assert.deepEqual(choice.serviceIds, [service.id]);
  assert.equal(choice.professionalId, pro.id);
  assert.equal(choice.date, selected.date);
  assert.equal(choice.time, row.title);
});

test("interactive responses preserve the complete selected command without executing data", () => {
  const id = "Consultar horários para corte no dia 15/10/2026";
  assert.equal(
    interactiveSelection({
      listResponseMessage: { singleSelectReply: { selectedRowId: id } },
    }),
    id,
  );
  assert.equal(
    interactiveSelection({ buttonsResponseMessage: { selectedButtonId: id } }),
    id,
  );
  assert.equal(
    interactiveSelection({
      interactiveResponseMessage: {
        nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id }) },
      },
    }),
    id,
  );
  assert.equal(
    interactiveSelection({
      interactiveResponseMessage: {
        nativeFlowResponseMessage: { paramsJson: "not-json" },
      },
    }),
    "",
  );
});
