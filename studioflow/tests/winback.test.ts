import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readDemo } from "../src/services/server-demo";
import { customerProfile } from "../src/services/assistant/receptionist";
import {
  asksToStop,
  winbackCandidates,
  winbackText,
  winbackWindow,
} from "../src/services/assistant/winback";
import type { Appointment, Store } from "../src/types";

/*
 * Memória do cliente e mensagem de retorno: quem recebe, o que diz e quem
 * pediu para parar.
 */
const now = new Date("2026-11-03T13:10:00Z");
const day = 86_400_000;

async function shop() {
  const store = await readDemo("barber-011");
  store.appointments = [];
  return store;
}
function visit(
  store: Store,
  phone: string,
  daysAgo: number,
  status: Appointment["status"] = "completed",
  name = "rafael souza",
) {
  const service = store.services.find((s) => s.active)!;
  const professional = store.professionals.find((p) => p.active)!;
  const start = new Date(now.getTime() - daysAgo * day).toISOString();
  store.appointments.push({
    id: randomUUID(),
    businessId: store.business.id,
    customerId: "",
    customerName: name,
    customerPhone: phone,
    customerEmail: "",
    professionalId: professional.id,
    serviceIds: [service.id],
    start,
    end: new Date(Date.parse(start) + service.duration * 60_000).toISOString(),
    status,
    price: service.price,
    reminder: true,
    notes: "",
    createdAt: start,
  } as Appointment);
  return { service, professional };
}

test("perfil do cliente da casa: visitas, o de sempre e com quem", async () => {
  const store = await shop();
  assert.equal(customerProfile(store, "11977776666", now), "");
  visit(store, "11977776666", 60);
  visit(store, "11977776666", 40);
  const { service, professional } = visit(store, "5511977776666", 20);
  const profile = customerProfile(store, "+55 11 97777-6666", now);
  assert.match(profile, /3 visitas, a última há 20 dias/);
  assert.match(profile, new RegExp(service.name.split(" ")[0], "i"));
  assert.match(profile, new RegExp(professional.name.split(" ")[0], "i"));
  assert.match(profile, /a cada 20 dias/);
});

test("retorno: só quem sumiu, sem horário futuro e sem bloqueio", async () => {
  const store = await shop();
  visit(store, "11911110001", 40); // sumiu
  visit(store, "11911110002", 10); // veio há pouco
  visit(store, "11911110003", 50); // sumiu, mas já marcou
  visit(store, "11911110003", -2, "confirmed");
  visit(store, "11911110004", 45); // pediu para parar
  visit(store, "11911110005", 200); // sumiu faz tempo demais
  visit(store, "11911110006", 38, "cancelled"); // nunca veio
  const due = winbackCandidates(store, now, 35, new Set(["11911110004"]));
  assert.deepEqual(
    due.map((c) => c.phone),
    ["11911110001"],
  );
  const text = winbackText(store, due[0]);
  assert.match(text, /^Oi, Rafael!/);
  assert.match(text, /PARAR/);
  assert.ok(text.includes(store.business.name));
});

test("retorno: janela das 10h e pedido para parar", () => {
  assert.equal(winbackWindow(now), true);
  assert.equal(winbackWindow(new Date("2026-11-03T15:00:00Z")), false);
  for (const yes of [
    "PARAR",
    "parar.",
    "Pare",
    "sair",
    "não quero mais receber",
  ])
    assert.equal(asksToStop(yes), true, yes);
  for (const no of [
    "quero marcar para sexta",
    "para amanhã tem horário?",
    "para sexta",
    "para amanha de tarde",
    "sim, pode ver",
  ])
    assert.equal(asksToStop(no), false, no);
});
