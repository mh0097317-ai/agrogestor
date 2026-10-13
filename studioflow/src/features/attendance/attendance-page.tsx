"use client";

import { useEffect, useState } from "react";
import { Check, Scissors, UserMinus } from "@phosphor-icons/react/dist/ssr";
import { monogram } from "@/lib/utils";
import { publicAccentStyle } from "@/features/public/public-branding";
import type { AppointmentStatus } from "@/types";
import "./attendance.css";

type View = {
  business: { name: string; logo: string; color: string };
  customer: string;
  services: string;
  professional: string;
  start: string;
  end: string;
  status: AppointmentStatus;
};
type Answer = "in_progress" | "completed" | "no_show";

const hour = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
const day = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));

const done: Partial<Record<AppointmentStatus, { title: string; text: string }>> = {
  completed: { title: "Atendimento concluído", text: "Valeu! A baixa já está na agenda. O pagamento entra no caixa como sempre." },
  no_show: { title: "Falta registrada", text: "O horário ficou como falta do cliente na agenda." },
  in_progress: { title: "Atendimento em andamento", text: "Quando terminar, toque em concluir." },
  cancelled: { title: "Horário cancelado", text: "Este horário foi cancelado na agenda." },
};

/** One-tap answer from the WhatsApp link: did the customer come? */
export function AttendancePage({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<Answer | "">("");
  const [answered, setAnswered] = useState(false);
  useEffect(() => {
    let alive = true;
    void fetch(`/api/attendance/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!alive) return;
        if (response.ok) setView(body as View);
        else setError(body.error || "Este link expirou ou não é válido.");
      })
      .catch(() => alive && setError("Sem conexão. Tente de novo."));
    return () => {
      alive = false;
    };
  }, [token]);
  async function answer(value: Answer) {
    setBusy(value);
    setError("");
    try {
      const response = await fetch(`/api/attendance/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: value }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar.");
      setView(body as View);
      setAnswered(true);
      navigator.vibrate?.(20);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy("");
    }
  }
  const final = view && done[view.status];
  const open = view && ["confirmed", "in_progress"].includes(view.status);
  return (
    <main className="att" style={view ? publicAccentStyle(view.business.color) : undefined}>
      <div className="att-card">
        {!view && !error && <span className="att-loader" aria-label="Carregando" />}
        {view && (
          <>
            <header className="att-brand">
              <span className="att-logo">
                {view.business.logo ? <img src={view.business.logo} alt="" /> : monogram(view.business.name)}
              </span>
              <span>
                <small>Baixa do atendimento</small>
                <b>{view.business.name}</b>
              </span>
            </header>
            <div className="att-slot">
              <time>{hour(view.start)}</time>
              <span>
                <b>{view.customer}</b>
                <small>
                  {view.services}
                  {view.professional ? ` · com ${view.professional}` : ""}
                </small>
                <small className="att-day">{day(view.start)}</small>
              </span>
            </div>
            {final && (answered || !open) && (
              <div className={`att-done ${answered ? "is-new" : ""} is-${view.status}`} role="status">
                <span className="att-done-mark">
                  {view.status === "no_show" ? <UserMinus size={26} weight="bold" /> : <Check size={26} weight="bold" />}
                </span>
                <b>{final.title}</b>
                <p>{final.text}</p>
              </div>
            )}
            {open && (
              <div className="att-actions">
                <p className="att-question">
                  {view.status === "confirmed" ? `${view.customer} veio?` : "Terminou o atendimento?"}
                </p>
                <button type="button" className="att-btn is-main" disabled={!!busy} onClick={() => void answer("completed")}>
                  <Check size={20} weight="bold" /> {busy === "completed" ? "Salvando..." : view.status === "confirmed" ? "Atendi" : "Concluir atendimento"}
                </button>
                {view.status === "confirmed" && (
                  <button type="button" className="att-btn" disabled={!!busy} onClick={() => void answer("in_progress")}>
                    <Scissors size={20} weight="bold" /> {busy === "in_progress" ? "Salvando..." : "Estou atendendo agora"}
                  </button>
                )}
                <button type="button" className="att-btn is-quiet" disabled={!!busy} onClick={() => void answer("no_show")}>
                  <UserMinus size={20} weight="bold" /> {busy === "no_show" ? "Salvando..." : "Cliente faltou"}
                </button>
              </div>
            )}
          </>
        )}
        {error && (
          <p className="att-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <p className="att-foot">StudioFlow · a agenda da barbearia</p>
    </main>
  );
}
