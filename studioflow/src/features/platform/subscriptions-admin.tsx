"use client";
import { useCallback, useEffect, useState } from "react";
import {
  priceLabel,
  type PlatformPlan,
  type SubscriptionRequest,
} from "@/lib/platform-plans";
import { moduleCatalog, type ModuleKey } from "@/lib/modules";

const reais = (cents: number | null) =>
  cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");
const cents = (value: string) => {
  const clean = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!clean) return null;
  const n = Math.round(Number(clean) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** /admin → Cobranças: preços dos planos e pedidos dos donos. */
export function SubscriptionsAdmin() {
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { monthly: string; annual: string }>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const [p, r] = await Promise.all([
      fetch("/api/admin/plans", { cache: "no-store" }).then((x) => x.json()),
      fetch("/api/admin/subscriptions", { cache: "no-store" }).then((x) => x.json()),
    ]);
    if (Array.isArray(p)) {
      setPlans(p);
      setDrafts(Object.fromEntries(p.map((x: PlatformPlan) => [x.key, { monthly: reais(x.monthlyCents), annual: reais(x.annualCents) }])));
    }
    if (Array.isArray(r)) setRequests(r);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external admin data
    void load();
  }, [load]);
  async function savePlan(plan: PlatformPlan) {
    setError("");
    const d = drafts[plan.key];
    const response = await fetch("/api/admin/plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...plan,
        active: plan.active !== false,
        monthlyCents: cents(d.monthly),
        annualCents: cents(d.annual),
      }),
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "Não foi possível salvar.");
    else {
      setNote(`${plan.name} salvo. A página /precos atualiza em até 5 minutos.`);
      await load();
    }
  }
  async function resolve(id: string, decision: "done" | "rejected") {
    setError("");
    const response = await fetch("/api/admin/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "Não foi possível resolver.");
    else setRequests(body);
  }
  const pending = requests.filter((r) => r.status === "pending");
  return (
    <section className="pf-subs" aria-labelledby="pf-subs-title">
      <h2 id="pf-subs-title">Planos e pedidos</h2>
      {error && <p className="pf-subs-error" role="alert">{error}</p>}
      {note && <p className="pf-subs-note" role="status">{note}</p>}
      <div className="pf-subs-plans">
        {plans.map((plan) => (
          <article key={plan.key}>
            <header>
              <strong>{plan.name}</strong>
              <span>{plan.modules.map((m) => moduleCatalog[m as ModuleKey]?.label).join(" · ") || "Base"}</span>
            </header>
            <label>
              Mensal (R$)
              <input
                inputMode="decimal"
                placeholder="Sob consulta"
                value={drafts[plan.key]?.monthly ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [plan.key]: { ...drafts[plan.key], monthly: e.target.value } })}
              />
            </label>
            <label>
              Anual (R$)
              <input
                inputMode="decimal"
                placeholder="Sem anual"
                value={drafts[plan.key]?.annual ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [plan.key]: { ...drafts[plan.key], annual: e.target.value } })}
              />
            </label>
            <small>Hoje na vitrine: {priceLabel(plan.monthlyCents)}</small>
            <button type="button" onClick={() => void savePlan(plan)}>
              Salvar
            </button>
          </article>
        ))}
      </div>
      <h3>Pedidos dos donos {pending.length > 0 && <em>{pending.length} em aberto</em>}</h3>
      {requests.length === 0 ? (
        <p className="pf-subs-empty">Nenhum pedido de troca ou cancelamento.</p>
      ) : (
        <ul className="pf-subs-requests" role="list">
          {requests.slice(0, 30).map((r) => (
            <li key={r.id} data-status={r.status}>
              <div>
                <strong>{r.businessName || "Estabelecimento"}</strong>
                <span>
                  {r.kind === "cancel"
                    ? "Cancelamento"
                    : `Trocar para ${plans.find((p) => p.key === r.toPlan)?.name || r.toPlan}`}{" "}
                  · {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                </span>
                {r.reason && <q>{r.reason}</q>}
              </div>
              {r.status === "pending" ? (
                <div className="pf-subs-actions">
                  <button type="button" onClick={() => void resolve(r.id, "done")}>
                    {r.kind === "cancel" ? "Registrar cancelamento" : "Aplicar plano"}
                  </button>
                  <button type="button" className="is-ghost" onClick={() => void resolve(r.id, "rejected")}>
                    Recusar
                  </button>
                </div>
              ) : (
                <em>{{ done: "Resolvido", rejected: "Recusado", withdrawn: "Retirado pelo dono", pending: "" }[r.status]}</em>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="pf-subs-foot">
        Aplicar um plano troca os módulos e a mensalidade do cliente. O
        cancelamento só fica registrado: suspenda o acesso em Estabelecimentos
        no fim do período pago.
      </p>
    </section>
  );
}
