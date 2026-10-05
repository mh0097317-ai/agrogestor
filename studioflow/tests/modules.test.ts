import test from "node:test";
import assert from "node:assert/strict";
import {
  allModules,
  applyModules,
  assertModule,
  enabledModules,
  hasModule,
  planCatalog,
  planFor,
} from "../src/lib/modules";
import { createSeed } from "../src/lib/seed";

test("módulos: sem escolha vale tudo; planos prontos são reconhecidos", () => {
  assert.deepEqual(enabledModules(null), allModules);
  assert.deepEqual(enabledModules(["produtos", "inventado"]), ["produtos"]);
  assert.equal(planFor(null), "premium");
  assert.equal(planFor(["espera", "fidelidade"]), "essencial");
  assert.equal(planFor([...planCatalog.profissional.modules].reverse()), "profissional");
  assert.equal(planFor(["produtos"]), null);
  assert.equal(hasModule([], "clube"), false);
  assert.throws(() => assertModule(["produtos"], "clube"), /não está incluído/);
  assert.doesNotThrow(() => assertModule(null, "clube"));
});

test("módulos: o que o plano não inclui some da página e do agendamento", () => {
  const store = createSeed();
  store.settings = {
    ...store.settings,
    depositMode: "fixed",
    depositValue: 20,
    assistantEnabled: true,
    loyaltyEnabled: true,
  };
  store.plans = [
    { id: "p", businessId: store.business.id, name: "Clube", description: "", price: 90, serviceIds: [store.services[0].id], monthlyLimit: 4, active: true, createdAt: "" },
  ];
  const essential = applyModules(store, planCatalog.essencial.modules);
  assert.equal(essential.settings.depositMode, "off");
  assert.equal(essential.settings.assistantEnabled, false);
  assert.equal(essential.settings.loyaltyEnabled, true);
  assert.deepEqual(essential.plans, []);
  assert.deepEqual(essential.products, []);
  // The stored settings are untouched: turning the module on brings them back.
  assert.equal(store.settings.depositMode, "fixed");
  const full = applyModules(store, null);
  assert.equal(full.settings.depositMode, "fixed");
  assert.equal(full.plans?.length, 1);
  assert.ok(full.products?.length);
});
