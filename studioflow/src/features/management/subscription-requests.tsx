"use client";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui";
import {
  priceLabel,
  type PlatformPlan,
  type SubscriptionRequest,
} from "@/lib/platform-plans";
import type { Store } from "@/types";

/**
 * Configurações → Plano: o dono pede troca de plano ou cancelamento. A equipe
 * StudioFlow aplica no /admin; nenhum valor muda sozinho.
 */
export function SubscriptionRequests({ store }: { store: Store }) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [mode, setMode] = useState<"" | "change" | "cancel">("");
  const [toPlan, setToPlan] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const owner = ["owner", "admin"].includes(store.viewer?.role || "");
  const load = useCallback(async () => {
    const response = await fetch("/api/workspace/subscription", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    setPlans(body.plans);
    setRequests(body.requests);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external subscription state
    void load();
  }, [load]);
  if (!owner) return null;
  const open = requests.find((r) => r.status === "pending");
  const current = (store.access?.plan || "").toLowerCase();
  async function send(body: unknown) {
    setBusy(true);
    try {
      const response = await fetch("/api/workspace/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar.");
      toast("Pedido enviado. A equipe StudioFlow confirma por WhatsApp ou e-mail.");
      setMode("");
      setReason("");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    setBusy(true);
    await fetch("/api/workspace/subscription", { method: "DELETE" });
    await load();
    setBusy(false);
    toast("Pedido retirado.");
  }
  const planName = (key: string | null) => plans.find((p) => p.key === key)?.name || key;
  return (
    <section className="subscription-requests" aria-labelledby="sub-req-title">
      <h3 id="sub-req-title">Mudar a assinatura</h3>
      {open ? (
        <div className="sub-open" role="status">
          <p>
            <strong>
              {open.kind === "cancel"
                ? "Pedido de cancelamento em análise."
                : `Troca para o plano ${planName(open.toPlan)} em análise.`}
            </strong>{" "}
            Enviado em {new Date(open.createdAt).toLocaleDateString("pt-BR")}.
          </p>
          <Button variant="ghost" disabled={busy} onClick={() => void withdraw()}>
            Retirar pedido
          </Button>
        </div>
      ) : mode === "change" ? (
        <div className="sub-form">
          <div className="sub-plans" role="radiogroup" aria-label="Plano">
            {plans
              .filter((p) => p.name.toLowerCase() !== current)
              .map((p) => (
                <label key={p.key} className={toPlan === p.key ? "is-on" : ""}>
                  <input
                    type="radio"
                    name="plan"
                    value={p.key}
                    checked={toPlan === p.key}
                    onChange={() => setToPlan(p.key)}
                  />
                  <strong>{p.name}</strong>
                  <span>{priceLabel(p.monthlyCents)}{p.monthlyCents !== null ? "/mês" : ""}</span>
                </label>
              ))}
          </div>
          <textarea
            placeholder="Algum detalhe? (opcional)"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setMode("")}>Voltar</Button>
            <Button
              disabled={busy || !toPlan}
              onClick={() => void send({ kind: "change_plan", toPlan, reason })}
            >
              Pedir a troca
            </Button>
          </div>
        </div>
      ) : mode === "cancel" ? (
        <div className="sub-form">
          <p>
            O acesso continua até o fim do período já pago. Seus dados ficam
            guardados e você pode exportar quando quiser.
          </p>
          <textarea
            placeholder="O que faltou para continuar? (obrigatório)"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setMode("")}>Voltar</Button>
            <Button
              disabled={busy || reason.trim().length < 3}
              onClick={() => void send({ kind: "cancel", reason })}
            >
              Pedir cancelamento
            </Button>
          </div>
        </div>
      ) : (
        <div className="sub-actions">
          <Button variant="secondary" onClick={() => setMode("change")}>
            Trocar de plano
          </Button>
          <Button variant="ghost" onClick={() => setMode("cancel")}>
            Cancelar assinatura
          </Button>
          <a href="/precos" target="_blank" rel="noreferrer">
            Comparar planos
          </a>
        </div>
      )}
    </section>
  );
}
