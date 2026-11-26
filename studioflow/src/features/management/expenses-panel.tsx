"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { DownloadSimple, Plus, Receipt } from "@phosphor-icons/react/dist/ssr";
import { Button, Card, DetailPanel } from "@/components/ui";
import { useToast } from "@/components/toast";
import { businessDay, dateLabel, money, paymentLabels } from "@/lib/utils";
import {
  change,
  expenseCategories,
  payables,
  previousPeriod,
  simpleDre,
  type Expense,
  type ExpenseCategory,
} from "@/lib/expenses";
import type { PaymentMethod, Store } from "@/types";
import { downloadCsv } from "./shared";
import { financeSummary, reais, type FinancePeriod } from "./finance-helpers";
import "./expenses.css";

const methods: PaymentMethod[] = ["pix", "cash", "credit", "debit", "other"];
const brl = (cents: number) => money(reais(cents));
const managers = ["owner", "admin", "manager"];

function Delta({ now, before, inverse }: { now: number; before: number; inverse?: boolean }) {
  const value = change(now, before);
  if (value === null) return <span className="expenses-delta">sem base</span>;
  const good = inverse ? value <= 0 : value >= 0;
  return (
    <span className={`expenses-delta ${good ? "is-good" : "is-bad"}`}>
      {Math.abs(value) > 9.99
        ? value > 0
          ? "+999%+"
          : "−999%+"
        : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(0)}%`}
    </span>
  );
}

/**
 * Despesas, contas a pagar e DRE simplificada (regime de caixa). Recebido =
 * pagamentos registrados + produtos vendidos; atendimento não fechado não entra.
 */
export function ExpensesPanel({
  store,
  period,
  presetAll,
}: {
  store: Store;
  period: FinancePeriod;
  presetAll: boolean;
}) {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(true);
  const [voiding, setVoiding] = useState<Expense | null>(null);
  const previous = presetAll ? null : previousPeriod(period);
  const allowed = !store.viewer || managers.includes(store.viewer.role);
  const today = businessDay();
  const load = useCallback(async () => {
    const from = previous?.from || period.from;
    const response = await fetch(
      `/api/workspace/expenses?from=${from}&to=${period.to}`,
      { cache: "no-store" },
    ).catch(() => null);
    if (!response?.ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setExpenses((await response.json()).expenses);
  }, [period.to, period.from, previous?.from]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external expenses state
    if (allowed) void load();
  }, [load, allowed]);
  if (!allowed) return null;

  const current = financeSummary(store, period);
  const dre = simpleDre({
    servicesCents: current.revenueCents,
    productsCents: current.productCents,
    commissionCents: current.commissionCents,
    expenses: expenses || [],
    ...period,
  });
  const before = previous
    ? (() => {
        const s = financeSummary(store, previous);
        return simpleDre({
          servicesCents: s.revenueCents,
          productsCents: s.productCents,
          commissionCents: s.commissionCents,
          expenses: expenses || [],
          ...previous,
        });
      })()
    : null;
  const bills = payables(expenses || [], today);

  async function send(method: "POST" | "PATCH", body: unknown) {
    setBusy(true);
    try {
      const response = await fetch("/api/workspace/expenses", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      await load();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível salvar.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Math.round(Number(String(form.get("amount")).replace(",", ".")) * 100);
    const ok = await send("POST", {
      category: form.get("category"),
      description: form.get("description"),
      amountCents: amount,
      dueDate: form.get("dueDate"),
      paid,
      ...(paid ? { paidAt: form.get("dueDate"), method: form.get("method") } : {}),
      repeatMonths: Number(form.get("repeat") || 0),
    });
    if (ok) {
      toast("Despesa lançada.");
      setAdding(false);
    }
  }
  function exportCsv() {
    const rows = (expenses || []).filter(
      (e) =>
        (e.dueDate >= period.from && e.dueDate <= period.to) ||
        (e.paidAt && e.paidAt >= period.from && e.paidAt <= period.to),
    );
    downloadCsv(
      [
        ["Vencimento", "Pago em", "Categoria", "Descrição", "Valor", "Forma", "Situação"],
        ...rows.map((e) => [
          e.dueDate,
          e.paidAt || "",
          expenseCategories[e.category],
          e.description,
          reais(e.amountCents).toFixed(2).replace(".", ","),
          e.method ? paymentLabels[e.method] : "",
          e.voidedAt ? `Estornada: ${e.voidReason || ""}` : e.paidAt ? "Paga" : "A pagar",
        ]),
      ],
      `despesas-${period.from}-a-${period.to}.csv`,
    );
    toast("Despesas do período exportadas.");
  }

  const dreRows: { label: string; now: number; before?: number; strong?: boolean; minus?: boolean }[] = [
    { label: "Serviços recebidos", now: dre.servicesCents, before: before?.servicesCents },
    { label: "Produtos vendidos", now: dre.productsCents, before: before?.productsCents },
    { label: "Receita recebida", now: dre.grossCents, before: before?.grossCents, strong: true },
    { label: "Comissões (estimadas)", now: dre.commissionCents, before: before?.commissionCents, minus: true },
    ...dre.lines.map((l) => ({
      label: expenseCategories[l.category],
      now: l.cents,
      before: before?.lines.find((b) => b.category === l.category)?.cents || 0,
      minus: true,
    })),
    { label: "Despesas pagas", now: dre.expensesCents, before: before?.expensesCents, strong: true, minus: true },
  ];

  return (
    <>
      <Card className="management-panel expenses">
        <div className="management-section-heading">
          <div>
            <h2>Resultado do período</h2>
            <p>
              DRE simplificada por regime de caixa: o que entrou e o que saiu de
              fato. Não substitui a contabilidade.
            </p>
          </div>
          <div className="expenses-actions">
            <Button variant="secondary" onClick={exportCsv} disabled={!expenses}>
              <DownloadSimple size={17} />
              Exportar despesas
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus size={17} />
              Lançar despesa
            </Button>
          </div>
        </div>
        {failed ? (
          <p className="expenses-error" role="alert">
            Não foi possível carregar as despesas. O resultado abaixo ficaria
            incompleto, por isso não é mostrado.{" "}
            <button type="button" onClick={() => void load()}>
              Tentar de novo
            </button>
          </p>
        ) : !expenses ? (
          <p className="expenses-loading">Carregando despesas…</p>
        ) : (
          <>
            <div className="expenses-result">
              <div>
                <span>Resultado</span>
                <strong className={dre.resultCents < 0 ? "is-negative" : ""}>
                  {brl(dre.resultCents)}
                </strong>
                {before && <Delta now={dre.resultCents} before={before.resultCents} />}
              </div>
              <div>
                <span>Margem</span>
                <strong>
                  {dre.margin === null ? "—" : `${(dre.margin * 100).toFixed(0)}%`}
                </strong>
              </div>
              <div>
                <span>A pagar</span>
                <strong>{brl(bills.openCents)}</strong>
                {bills.overdueCents > 0 && (
                  <em className="expenses-overdue">{brl(bills.overdueCents)} vencido</em>
                )}
              </div>
            </div>
            <div className="management-table-wrap">
              <table className="management-table expenses-dre">
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Este período</th>
                    {before && <th>Anterior</th>}
                  </tr>
                </thead>
                <tbody>
                  {dreRows.map((row) => (
                    <tr key={row.label} className={row.strong ? "is-strong" : ""}>
                      <td>{row.label}</td>
                      <td>
                        {row.minus && row.now ? "− " : ""}
                        {brl(row.now)}
                      </td>
                      {before && (
                        <td>
                          {row.minus && row.before ? "− " : ""}
                          {brl(row.before || 0)}{" "}
                          <Delta now={row.now} before={row.before || 0} inverse={row.minus} />
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="is-total">
                    <td>Resultado</td>
                    <td>{brl(dre.resultCents)}</td>
                    {before && <td>{brl(before.resultCents)}</td>}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="management-top-description">
              {previous &&
                `Comparado com ${dateLabel(`${previous.from}T12:00:00Z`, "dd/MM")} a ${dateLabel(`${previous.to}T12:00:00Z`, "dd/MM")}, o mesmo número de dias logo antes. `}
              Comissões são estimativas pelo percentual atual de cada
              profissional. Custo dos produtos vendidos não entra porque as
              vendas antigas não guardam o custo; lance compras de produtos como
              despesa.
            </p>
          </>
        )}
      </Card>
      {expenses && (
        <Card className="management-panel">
          <div className="management-section-heading">
            <div>
              <h2>Contas a pagar</h2>
              <p>Em aberto, de qualquer data. Vencidas primeiro.</p>
            </div>
            <Receipt size={22} weight="duotone" aria-hidden="true" />
          </div>
          {bills.open.length === 0 ? (
            <p className="expenses-empty">
              Nenhuma conta em aberto. Lance aluguel, contas e compras para ver
              o resultado real do mês.
            </p>
          ) : (
            <ul className="expenses-list" role="list">
              {bills.open.slice(0, 30).map((e) => (
                <li key={e.id} className={e.dueDate < today ? "is-overdue" : ""}>
                  <div>
                    <strong>{e.description}</strong>
                    <span>
                      {expenseCategories[e.category]} · vence{" "}
                      {dateLabel(`${e.dueDate}T12:00:00Z`, "dd/MM")}
                      {e.dueDate < today ? " · vencida" : ""}
                    </span>
                  </div>
                  <strong>{brl(e.amountCents)}</strong>
                  <div className="expenses-row-actions">
                    <select
                      aria-label={`Como pagou ${e.description}`}
                      defaultValue=""
                      disabled={busy}
                      onChange={async (event) => {
                        const method = event.target.value;
                        if (!method) return;
                        event.target.value = "";
                        if (
                          await send("PATCH", { action: "pay", id: e.id, paidAt: today, method })
                        )
                          toast(`${e.description}: paga hoje.`);
                      }}
                    >
                      <option value="">Pagar hoje…</option>
                      {methods.map((m) => (
                        <option key={m} value={m}>
                          {paymentLabels[m]}
                        </option>
                      ))}
                    </select>
                    <Button variant="ghost" disabled={busy} onClick={() => setVoiding(e)}>
                      Estornar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <DetailPanel
        open={adding}
        onClose={() => setAdding(false)}
        title="Lançar despesa"
        description="Valores em reais. Lançamento errado é estornado, nunca apagado."
      >
        <form className="management-form expenses-form" onSubmit={add}>
          <label>
            Categoria
            <select name="category" defaultValue="contas" required>
              {(Object.keys(expenseCategories) as ExpenseCategory[]).map((k) => (
                <option key={k} value={k}>
                  {expenseCategories[k]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Descrição
            <input name="description" maxLength={120} required placeholder="Ex.: Aluguel de novembro" />
          </label>
          <label>
            Valor (R$)
            <input name="amount" inputMode="decimal" required pattern="\d+([.,]\d{1,2})?" placeholder="0,00" />
          </label>
          <label>
            {paid ? "Pago em" : "Vence em"}
            <input name="dueDate" type="date" defaultValue={today} required />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Já
            foi pago
          </label>
          {paid && (
            <label>
              Forma de pagamento
              <select name="method" defaultValue="pix">
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {paymentLabels[m]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Repetir nos próximos meses
            <select name="repeat" defaultValue="0">
              <option value="0">Não repete</option>
              {[2, 3, 5, 11].map((n) => (
                <option key={n} value={n}>
                  Mais {n} meses (a pagar)
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Voltar
            </Button>
            <Button type="submit" disabled={busy}>
              Lançar
            </Button>
          </div>
        </form>
      </DetailPanel>
      <DetailPanel
        open={!!voiding}
        onClose={() => setVoiding(null)}
        title="Estornar despesa"
        description={voiding ? `${voiding.description} · ${brl(voiding.amountCents)}. Fica no histórico como estornada.` : ""}
      >
        <form
          className="management-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!voiding) return;
            const reason = String(new FormData(event.currentTarget).get("reason") || "");
            if (await send("PATCH", { action: "void", id: voiding.id, reason })) {
              toast("Despesa estornada.");
              setVoiding(null);
            }
          }}
        >
          <label>
            Motivo
            <input name="reason" minLength={3} maxLength={200} required placeholder="Ex.: lançada em dobro" />
          </label>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => setVoiding(null)}>
              Voltar
            </Button>
            <Button type="submit" disabled={busy}>
              Estornar
            </Button>
          </div>
        </form>
      </DetailPanel>
    </>
  );
}
