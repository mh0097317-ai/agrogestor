import test from "node:test";
import assert from "node:assert/strict";
import {
  annualSaving,
  defaultPlans,
  priceLabel,
  subscriptionRequestSchema,
} from "../src/lib/platform-plans";
import {
  adminSubscriptionRequests,
  ownSubscriptionRequests,
  publicPlans,
  requestSubscriptionChange,
  resolveSubscriptionRequest,
  withdrawSubscriptionRequest,
} from "../src/services/platform-plans";
import { mutateDemo, readDemo } from "../src/services/server-demo";

test("vitrine sem preço definido mostra 'Sob consulta', nunca um valor inventado", () => {
  assert.equal(priceLabel(null), "Sob consulta");
  assert.match(priceLabel(14990), /R\$\s?149,90/);
  assert.ok(defaultPlans.every((p) => p.monthlyCents === null));
  assert.equal(annualSaving({ monthlyCents: 10000, annualCents: 100000 }), 20000);
  assert.equal(annualSaving({ monthlyCents: null, annualCents: 100000 }), 0);
});

test("cancelar exige motivo; trocar exige um plano", () => {
  assert.throws(() => subscriptionRequestSchema.parse({ kind: "cancel", reason: "" }));
  assert.throws(() => subscriptionRequestSchema.parse({ kind: "change_plan" }));
  assert.ok(subscriptionRequestSchema.parse({ kind: "change_plan", toPlan: "premium" }));
});

test("demonstração: dono pede troca, um pedido aberto por vez, equipe aplica", async () => {
  await mutateDemo((store) => {
    store.subscriptionRequests = [];
  });
  const plans = await publicPlans();
  assert.equal(plans.length, 3);
  const request = await requestSubscriptionChange({ kind: "change_plan", toPlan: "premium" });
  assert.equal(request.status, "pending");
  await assert.rejects(
    requestSubscriptionChange({ kind: "cancel", reason: "Fechando a loja" }),
    /em análise/,
  );
  assert.equal((await ownSubscriptionRequests()).length, 1);
  const queue = await adminSubscriptionRequests();
  assert.ok(queue.some((r) => r.id === request.id && r.businessName));
  await resolveSubscriptionRequest({ id: request.id, decision: "done" });
  const store = await readDemo();
  assert.equal(store.subscriptionRequests?.[0].status, "done");
  assert.equal(store.access?.plan, "Premium");
  // Depois de resolvido, dá para abrir outro pedido e retirá-lo.
  await requestSubscriptionChange({ kind: "cancel", reason: "Testando" });
  await withdrawSubscriptionRequest();
  assert.ok(!(await ownSubscriptionRequests()).some((r) => r.status === "pending"));
  await assert.rejects(
    requestSubscriptionChange({ kind: "change_plan", toPlan: "inexistente" }),
    /plano disponível/,
  );
});
