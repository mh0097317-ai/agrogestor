"use client";
import { useCallback, useEffect, useState } from "react";

interface CostItem {
  businessId: string;
  businessName: string;
  usd: number;
  brlCents: number | null;
  inputTokens: number;
  outputTokens: number;
  unpricedTokens: number;
  budgetCents: number | null;
  state: "none" | "ok" | "near" | "over" | "unknown";
}
const brl = (cents: number | null) =>
  cents === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const usd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const stateLabel = {
  none: "Sem teto",
  ok: "Dentro do teto",
  near: "Acima de 80%",
  over: "Teto atingido (IA pausada)",
  unknown: "Defina o câmbio",
};

/** Custo da IA no mês, por casa. Estimativa pelos preços oficiais por modelo. */
export function AiCostsCard() {
  const [items, setItems] = useState<CostItem[] | null>(null);
  const [rate, setRate] = useState("");
  const [demo, setDemo] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/ai-costs", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error || "Não foi possível ler o consumo.");
    setItems(body.items);
    setDemo(!!body.demo);
    setRate(body.rate ? String(body.rate).replace(".", ",") : "");
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external admin data
    void load();
  }, [load]);
  async function put(body: unknown, done: string) {
    const response = await fetch("/api/admin/ai-costs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setMessage(response.ok ? done : result.error || "Não foi possível salvar.");
    if (response.ok) await load();
  }
  if (!items) return message ? <p role="status">{message}</p> : null;
  const total = items.reduce((sum, i) => sum + i.usd, 0);
  return (
    <section className="pf-readiness pf-aicost" aria-labelledby="pf-aicost-title">
      <header>
        <div>
          <span className="pf-eyebrow">Consumo de IA no mês</span>
          <h2 id="pf-aicost-title">
            {demo ? "Disponível no ambiente publicado" : `${usd(total)} estimados`}
          </h2>
        </div>
        <label className="pf-aicost-rate">
          Câmbio US$ → R$
          <input
            inputMode="decimal"
            placeholder="ex.: 5,40"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => {
              const value = rate.trim() ? Number(rate.replace(",", ".")) : null;
              if (value === null || (value >= 1 && value <= 50))
                void put({ rate: value }, "Câmbio salvo.");
            }}
          />
        </label>
      </header>
      {message && <p className="pf-subs-note" role="status">{message}</p>}
      {items.length === 0 ? (
        <p className="pf-subs-empty">Nenhum consumo registrado por modelo neste mês ainda.</p>
      ) : (
        <ul role="list">
          {items.map((item) => (
            <li key={item.businessId} data-ok={item.state === "ok" || item.state === "none" ? "" : undefined}>
              <span>
                <strong>{item.businessName}</strong>
                <small>
                  {usd(item.usd)} · {brl(item.brlCents)} ·{" "}
                  {(item.inputTokens + item.outputTokens).toLocaleString("pt-BR")} tokens
                  {item.unpricedTokens > 0 && ` (${item.unpricedTokens.toLocaleString("pt-BR")} sem preço)`}
                </small>
              </span>
              <label className="pf-aicost-budget">
                Teto R$
                <input
                  inputMode="decimal"
                  defaultValue={item.budgetCents === null ? "" : (item.budgetCents / 100).toFixed(2).replace(".", ",")}
                  placeholder="sem teto"
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const cents = raw ? Math.round(Number(raw.replace(/\./g, "").replace(",", ".")) * 100) : null;
                    if (cents === null || Number.isFinite(cents))
                      void put({ businessId: item.businessId, budgetCents: cents }, "Teto salvo.");
                  }}
                />
              </label>
              <em>{stateLabel[item.state]}</em>
            </li>
          ))}
        </ul>
      )}
      <p className="pf-subs-foot">
        Estimativa pelos preços oficiais por milhão de tokens de cada modelo
        (sem cache e sem transcrição de áudio). A fatura real é a do provedor.
      </p>
    </section>
  );
}
