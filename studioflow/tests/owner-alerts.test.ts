import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  aiCredentialProblem,
  ownerAlerts,
  unfinishedAppointments,
  whatsappDown,
} from "../src/lib/owner-alerts";
import type { Store } from "../src/types";

const NOW = Date.parse("2026-11-24T15:00:00Z");

function store(patch: Partial<Store> = {}): Store {
  const seed = createSeed();
  return {
    ...seed,
    appointments: [],
    whatsappLink: { status: "open", phone: "5562999990000", profileName: "" },
    whatsapp: null,
    professionalWhatsAppLinks: [],
    settings: { ...seed.settings, assistantEnabled: true },
    ...patch,
  };
}

test("tudo certo: a faixa não aparece", () => {
  assert.deepEqual(ownerAlerts(store(), { now: NOW, attention: 0 }), []);
});

test("WhatsApp da casa caído pede reconexão; com a API da Meta, não", () => {
  const down = store({
    whatsappLink: { status: "close", phone: "", profileName: "" },
  });
  const [alert] = ownerAlerts(down, { now: NOW });
  assert.equal(alert.id, "whatsapp");
  assert.equal(alert.action.href, "/dashboard/configuracoes?aba=whatsapp");
  assert.match(alert.detail, /recepcionista não responde/);
  assert.deepEqual(
    whatsappDown({
      ...down,
      whatsapp: { displayPhone: "+55", phoneNumberId: "1" },
    }),
    [],
  );
});

test("número de profissional caído entra pelo primeiro nome", () => {
  const seed = store();
  const person = seed.professionals.find((p) => p.active)!;
  const data = store({
    professionalWhatsAppLinks: [
      {
        status: "connecting",
        phone: "",
        profileName: "",
        professionalId: person.id,
      },
    ],
  });
  assert.deepEqual(whatsappDown(data), [person.name.split(" ")[0]]);
});

test("chave da IA recusada só aparece se a última execução falhou por credencial", () => {
  assert.equal(
    aiCredentialProblem({ state: "FAILED", errorCode: "provider-auth" }),
    true,
  );
  assert.equal(
    aiCredentialProblem({ state: "FAILED", errorCode: "provider-timeout" }),
    false,
  );
  assert.equal(
    aiCredentialProblem({ state: "SENT", errorCode: "provider-auth" }),
    false,
  );
  const alerts = ownerAlerts(store(), {
    now: NOW,
    latestRun: { state: "FAILED", errorCode: "missing-key" },
    support: "5562900000000",
  });
  assert.equal(alerts[0].id, "ai");
  assert.equal(alerts[0].action.external, true);
  assert.match(alerts[0].action.href, /^https:\/\/wa\.me\/5562900000000\?text=/);
  // IA desligada: erro antigo não vira alerta.
  const off = store();
  off.settings = { ...off.settings, assistantEnabled: false };
  assert.deepEqual(
    ownerAlerts(off, {
      now: NOW,
      latestRun: { state: "FAILED", errorCode: "missing-key" },
    }),
    [],
  );
});

test("conversas esperando e horários passados sem finalizar", () => {
  const seed = store();
  const base = seed.professionals[0];
  const appointment = (day: string, status: "confirmed" | "completed") => ({
    id: `${day}-${status}`,
    businessId: seed.business.id,
    customerId: "c",
    customerName: "Carlos",
    customerPhone: "62999990000",
    serviceIds: [],
    professionalId: base.id,
    start: `${day}T13:00:00Z`,
    end: `${day}T13:30:00Z`,
    price: 50,
    status,
    reminder: false,
    createdAt: `${day}T10:00:00Z`,
  });
  const data = store({
    appointments: [
      appointment("2026-11-23", "confirmed"),
      appointment("2026-11-22", "confirmed"),
      appointment("2026-11-23", "completed"),
      appointment("2026-11-10", "confirmed"), // mais de 7 dias: fica fora
      appointment("2026-11-24", "confirmed"), // hoje: o Salão cuida
    ],
  });
  assert.deepEqual(
    unfinishedAppointments(data, NOW).map((a) => a.id),
    ["2026-11-22-confirmed", "2026-11-23-confirmed"],
  );
  const alerts = ownerAlerts(data, { now: NOW, attention: 3 });
  assert.deepEqual(
    alerts.map((a) => a.id),
    ["conversations", "unfinished"],
  );
  assert.equal(alerts[0].title, "3 conversas esperando a equipe");
  assert.equal(alerts[1].action.href, "/dashboard/agenda?date=2026-11-22");
});
