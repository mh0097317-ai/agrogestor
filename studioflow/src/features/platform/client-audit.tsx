"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuditSummary } from "@/lib/audit-summary";
import type { PlatformBusiness } from "@/services/platform";

interface TimelineRow {
  id: string;
  source: "painel" | "cliente" | "recepcionista" | "sistema" | "plataforma";
  action: string;
  detail: string;
  actor: string;
  createdAt: string;
}
interface AuditView {
  period: { from: string; to: string };
  summary: AuditSummary;
  timeline: TimelineRow[];
}

const ranges = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];
const clickLabels: Record<string, string> = {
  agendar: "Agendar",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  localizacao: "Localização",
  compartilhar: "Compartilhar",
  chat: "Chat com a recepcionista",
  clube: "Clube",
};
const sourceLabels: Record<TimelineRow["source"], string> = {
  painel: "Painel",
  cliente: "Cliente",
  recepcionista: "Recepcionista",
  sistema: "Sistema",
  plataforma: "StudioFlow",
};
const filters = ["todos", "painel", "cliente", "recepcionista", "sistema"] as const;

const isoDay = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
const percent = (value: number, base: number) => (base ? `${Math.round((value / base) * 100)}%` : "–");

/**
 * Tudo o que aconteceu com o estabelecimento: por fora (visitas, cliques e
 * agendamentos dos clientes) e por dentro (o que a equipe fez no painel).
 */
export function ClientAudit({ item }: { item: PlatformBusiness }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AuditView | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("todos");

  useEffect(() => {
    let alive = true;
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    fetch(`/api/admin/platform/${item.id}/audit?from=${isoDay(from)}&to=${isoDay(to)}`, { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error || "Não foi possível carregar a auditoria.");
        if (alive) {
          setData(json as AuditView);
          setError("");
        }
      })
      .catch((cause) => alive && setError(cause instanceof Error ? cause.message : "Falha de conexão."));
    return () => {
      alive = false;
    };
  }, [item.id, days]);

  const timeline = useMemo(
    () => (data?.timeline || []).filter((row) => filter === "todos" || row.source === filter),
    [data, filter],
  );
  const s = data?.summary;
  const peak = Math.max(1, ...(s?.daily || []).map((day) => day.visits));

  return (
    <section className="pf-block pf-audit">
      <div className="pf-audit-head">
        <h3>Auditoria</h3>
        <div className="pf-chips" role="radiogroup" aria-label="Período da auditoria">
          {ranges.map((range) => (
            <button
              key={range.days}
              type="button"
              role="radio"
              aria-checked={days === range.days}
              className={days === range.days ? "is-on" : ""}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="pf-error">{error}</p>}
      {!s && !error && <p className="pf-audit-empty">Carregando…</p>}
      {s && (
        <>
          <h4>Por fora: a página do estabelecimento</h4>
          <div className="pf-metrics">
            <article>
              <span>Visitas</span>
              <strong>{s.visits.toLocaleString("pt-BR")}</strong>
            </article>
            <article>
              <span>Pessoas diferentes</span>
              <strong>{s.visitors.toLocaleString("pt-BR")}</strong>
            </article>
            {Object.entries(clickLabels).map(([key, label]) => (
              <article key={key}>
                <span>Cliques em {label}</span>
                <strong>{(s.clicks[key] || 0).toLocaleString("pt-BR")}</strong>
              </article>
            ))}
          </div>

          <h4>Funil até o agendamento</h4>
          <ol className="pf-funnel">
            {s.funnel.map((step, index) => (
              <li key={step.label}>
                <span>{step.label}</span>
                <i aria-hidden="true">
                  <em style={{ width: percent(step.value, s.funnel[0].value || step.value || 1) }} />
                </i>
                <b>{step.value.toLocaleString("pt-BR")}</b>
                <small>{index === 0 ? "" : percent(step.value, s.funnel[0].value)}</small>
              </li>
            ))}
          </ol>

          {s.daily.length > 0 && (
            <>
              <h4>Visitas por dia</h4>
              <div className="pf-daily" role="img" aria-label={`Visitas por dia, máximo de ${peak}`}>
                {s.daily.map((day) => (
                  <span
                    key={day.day}
                    title={`${day.day.split("-").reverse().join("/")}: ${day.visits} visitas, ${day.bookings} agendamentos`}
                  >
                    <i style={{ height: `${Math.max(4, (day.visits / peak) * 100)}%` }} />
                  </span>
                ))}
              </div>
            </>
          )}

          <div className="pf-audit-split">
            <div>
              <h4>De onde vêm</h4>
              <ul className="pf-audit-list">
                {s.referrers.length ? (
                  s.referrers.map((row) => (
                    <li key={row.label}>
                      <span>{row.label === "direto" ? "Direto ou link salvo" : row.label}</span>
                      <b>{row.value}</b>
                    </li>
                  ))
                ) : (
                  <li>Ainda sem visitas no período.</li>
                )}
              </ul>
            </div>
            <div>
              <h4>Aparelho</h4>
              <ul className="pf-audit-list">
                {s.devices.length ? (
                  s.devices.map((row) => (
                    <li key={row.label}>
                      <span>{row.label}</span>
                      <b>{percent(row.value, s.visits)}</b>
                    </li>
                  ))
                ) : (
                  <li>–</li>
                )}
              </ul>
            </div>
          </div>

          <h4>Linha do tempo: tudo o que aconteceu</h4>
          <div className="pf-chips" role="radiogroup" aria-label="Filtrar a linha do tempo">
            {filters.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={filter === key}
                className={filter === key ? "is-on" : ""}
                onClick={() => setFilter(key)}
              >
                {key === "todos" ? "Tudo" : sourceLabels[key]}
              </button>
            ))}
          </div>
          {timeline.length ? (
            <ol className="pf-timeline">
              {timeline.map((row) => (
                <li key={row.id} className={`is-${row.source}`}>
                  <time>{when(row.createdAt)}</time>
                  <span className="pf-timeline-tag">{sourceLabels[row.source]}</span>
                  <p>
                    <b>{row.action}</b>
                    {row.detail && <> · {row.detail}</>}
                    {row.actor && row.source === "painel" && <small> por {row.actor}</small>}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="pf-audit-empty">Nada registrado neste período.</p>
          )}
          <p className="pf-metric-note">
            Visitas e cliques usam um código aleatório do aparelho, sem nome, telefone ou IP. O registro começou na
            publicação desta versão; antes dela não há histórico.
          </p>
        </>
      )}
    </section>
  );
}
