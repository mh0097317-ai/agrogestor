"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  Receipt,
} from "@phosphor-icons/react/dist/ssr";
import type { PlatformInvoice } from "@/types";
import "./fee-payment.css";

interface BillingView {
  ready: boolean;
  plan: string;
  price: number | null;
  until: string | null;
  state: string;
  billable: boolean;
  document: string;
  open: PlatformInvoice | null;
  invoices: PlatformInvoice[];
}

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value),
  );
const documentMask = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11)
    return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

async function call<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data as T;
}

/**
 * Mensalidade do StudioFlow: gera a fatura (Pix, boleto ou cartão no Asaas)
 * e, quando o pagamento cai, o acesso abre sozinho.
 */
export function FeePayment({
  onPaid,
  showHistory = false,
  demo = false,
}: {
  onPaid?: () => void | Promise<void>;
  showHistory?: boolean;
  demo?: boolean;
}) {
  const [view, setView] = useState<BillingView | null>(null);
  const [document, setDocument] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let alive = true;
    call<BillingView>("/api/workspace/billing")
      .then((data) => alive && setView(data))
      .catch(() => alive && setView(null));
    return () => {
      alive = false;
    };
  }, []);

  // With the invoice open, check by itself every 10 s while this is on screen.
  const pending = !!view?.open && !paid;
  useEffect(() => {
    if (!pending || demo) return;
    const timer = window.setInterval(() => void check(true), 10_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, demo]);

  if (!view || !view.billable || !view.price) return null;

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("pay");
    setError("");
    try {
      const invoice = await call<PlatformInvoice>("/api/workspace/billing", "POST", { document });
      setView((current) => (current ? { ...current, open: invoice } : current));
      if (invoice.invoiceUrl) window.open(invoice.invoiceUrl, "_blank", "noopener");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar a cobrança.");
    } finally {
      setBusy("");
    }
  }
  async function check(quiet = false) {
    if (!quiet) setBusy("check");
    try {
      const result = await call<{ paid: boolean }>("/api/workspace/billing/check", "POST");
      if (result.paid) {
        setPaid(true);
        await onPaid?.();
      } else if (!quiet) setError("Ainda não recebemos. Pix cai na hora; boleto leva até 2 dias úteis.");
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : "Não foi possível conferir.");
    } finally {
      if (!quiet) setBusy("");
    }
  }

  if (paid)
    return (
      <div className="fee fee-done" role="status">
        <CheckCircle size={26} weight="fill" />
        <div>
          <strong>Pagamento recebido</strong>
          <span>Seu acesso foi renovado. Obrigado!</span>
        </div>
      </div>
    );

  const due = view.open?.dueDate || view.until;
  return (
    <div className="fee">
      <div className="fee-head">
        <Receipt size={22} weight="duotone" />
        <div>
          <span>Mensalidade StudioFlow{view.plan ? ` · ${view.plan}` : ""}</span>
          <strong>{money(view.open?.value || view.price)}</strong>
        </div>
        {due && <small>{view.state === "expired" ? "Venceu em" : "Vence em"} {date(due)}</small>}
      </div>
      {!view.ready && !demo ? (
        <p className="fee-note">A cobrança online está sendo ligada. Enquanto isso, fale com a equipe StudioFlow.</p>
      ) : view.open ? (
        <div className="fee-actions">
          {view.open.invoiceUrl ? (
            <a className="btn btn-primary" href={view.open.invoiceUrl} target="_blank" rel="noreferrer">
              <ArrowSquareOut size={16} /> Abrir cobrança (Pix, boleto ou cartão)
            </a>
          ) : (
            <p className="fee-note">Demonstração: confirme abaixo para simular o pagamento.</p>
          )}
          <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => void check()}>
            {busy === "check" ? <CircleNotch size={16} className="fee-spin" /> : <CheckCircle size={16} />}
            {demo ? "Simular pagamento" : "Já paguei, conferir"}
          </button>
        </div>
      ) : (
        <form className="fee-actions" onSubmit={pay}>
          {!view.document && (
            <label className="fee-document">
              <span>CPF ou CNPJ do responsável</span>
              <input
                value={documentMask(document)}
                onChange={(event) => setDocument(event.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="000.000.000-00"
                required={!demo}
              />
            </label>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!!busy || (!view.document && !demo && document.length !== 11 && document.length !== 14)}
          >
            {busy === "pay" ? <CircleNotch size={16} className="fee-spin" /> : <Receipt size={16} />}
            {busy === "pay" ? "Gerando cobrança…" : "Pagar mensalidade"}
          </button>
        </form>
      )}
      {error && (
        <p className="fee-error" role="alert">
          {error}
        </p>
      )}
      {showHistory && view.invoices.some((item) => item.status === "paid") && (
        <ul className="fee-history">
          {view.invoices
            .filter((item) => item.status === "paid")
            .map((item) => (
              <li key={item.id}>
                <span>{date(item.paidAt || item.createdAt)}</span>
                <b>{money(item.value)}</b>
                <em>Pago</em>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
