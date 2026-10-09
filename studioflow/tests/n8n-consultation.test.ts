import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { sha256 } from "../src/services/server-secrets";
import {
  n8nConsultation,
  n8nConsultationSchema,
  n8nIntegration,
  type N8nIntegration,
} from "../src/services/assistant/n8n-consultation";

const storeForTest = () => {
  const store = createSeed();
  store.settings.assistantEnabled = true;
  return store;
};
const scopeFor = (store: ReturnType<typeof createSeed>): N8nIntegration => ({
  slug: store.business.slug,
  businessId: store.business.id,
  professionalId: store.professionals[0].id,
  tokenHash: sha256("test-token").toString("hex"),
});

test("n8n: credentials fail closed and cannot select another tenant", () => {
  const scope = scopeFor(storeForTest());
  const config = JSON.stringify([scope]);
  assert.deepEqual(n8nIntegration("test-token", config), scope);
  for (const token of [null, "", "wrong-token"])
    assert.throws(() => n8nIntegration(token, config), /não autorizada/);
  assert.throws(() => n8nIntegration("test-token", "invalid"), /indisponível/);
  assert.throws(
    () => n8nIntegration("test-token", JSON.stringify([scope, scope])),
    /não autorizada/,
  );
  assert.equal(
    n8nConsultationSchema.safeParse({ acao: "catalogo", businessId: "another" })
      .success,
    false,
  );
  assert.equal(
    n8nConsultationSchema.safeParse({ acao: "agendar" }).success,
    false,
  );
});

test("n8n: scoped catalog excludes customers, appointments, tokens and private professional fields", async () => {
  const store = storeForTest();
  const result = await n8nConsultation(
    { acao: "catalogo" },
    scopeFor(store),
    async () => store,
  );
  assert.ok("servicos" in result);
  if (!result.servicos || !result.profissionais) return;
  assert.ok(result.servicos.length);
  assert.equal(result.profissionais.length, 1);
  assert.ok(
    result.servicos.every((s) =>
      s.profissionais.every((id) => id === store.professionals[0].id),
    ),
  );
  const serialized = JSON.stringify(result);
  for (const field of [
    "customerPhone",
    "customers",
    "appointments",
    "tokenHash",
    "commission",
    "tenantId",
  ])
    assert.equal(serialized.includes(field), false);
  assert.equal(serialized.includes(store.professionals[0].phone), false);
});

test("n8n: tenant mismatch, disabled assistant and out-of-scope professionals are rejected", async () => {
  const store = storeForTest();
  const scope = scopeFor(store);
  await assert.rejects(
    n8nConsultation(
      { acao: "catalogo" },
      { ...scope, businessId: "another" },
      async () => store,
    ),
    /não autorizada/,
  );
  await assert.rejects(
    n8nConsultation({ acao: "catalogo" }, scope, async () => ({
      ...store,
      settings: { ...store.settings, assistantEnabled: false },
    })),
    /desativado/,
  );
  const service = store.services.find((s) =>
    s.professionalIds.includes(scope.professionalId!),
  )!;
  await assert.rejects(
    n8nConsultation(
      {
        acao: "horarios_livres",
        servicos: [service.id],
        data: "2026-10-10",
        profissional: store.professionals[1].id,
        periodo: "all",
      },
      scope,
      async () => store,
    ),
    /fora do escopo/,
  );
});

test("n8n: fresh availability respects blocks and never writes appointments", async () => {
  const store = storeForTest();
  const scope = scopeFor(store);
  const now = new Date("2026-10-09T10:00:00-03:00");
  const service = store.services.find(
    (s) => s.active && s.professionalIds.includes(scope.professionalId!),
  )!;
  const input = {
    acao: "horarios_livres" as const,
    servicos: [service.id],
    data: "2026-10-10",
    profissional: "any",
    periodo: "morning" as const,
  };
  const before = store.appointments.length;
  const first = await n8nConsultation(input, scope, async () => store, now);
  assert.ok(
    "resultado" in first &&
      Array.isArray(first.resultado) &&
      first.resultado.length,
  );
  if (!("resultado" in first) || !Array.isArray(first.resultado)) return;
  const selected = first.resultado[0];
  store.blockedTimes.push({
    id: "test-block",
    businessId: store.business.id,
    professionalId: scope.professionalId!,
    start: selected.inicio,
    end: new Date(new Date(selected.inicio).getTime() + 3600000).toISOString(),
    reason: "test",
  });
  const next = await n8nConsultation(input, scope, async () => store, now);
  assert.ok("resultado" in next);
  if (!("resultado" in next)) return;
  assert.ok(
    !Array.isArray(next.resultado) ||
      next.resultado.every((s) => s.inicio !== selected.inicio),
  );
  assert.equal(store.appointments.length, before);
  assert.equal(next.reserva_realizada, false);
  await assert.rejects(
    n8nConsultation(
      { ...input, data: "2026-02-31" },
      scope,
      async () => store,
      now,
    ),
    /Data inválida/,
  );
});
