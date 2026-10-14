"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle,
  EnvelopeSimple,
  Eye,
  PaperPlaneTilt,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import "./ai-control.css";
import "./email-panel.css";
import { EmailComposer } from "./email-composer";

type Template = "billing" | "welcome" | "setup" | "share" | "weekly";
interface Settings {
  enabled: boolean;
  billing: boolean;
  onboarding: boolean;
  weekly: boolean;
  replyTo: string;
}
interface Overview {
  configured: boolean;
  from: string;
  settings: Settings;
  demo: boolean;
  counts: Record<string, { sent: number; failed: number }>;
  recent: {
    id: string;
    kind: string;
    recipient: string;
    subject: string;
    status: "sent" | "failed";
    error: string;
    createdAt: string;
  }[];
}

async function api<T>(method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/admin/emails", {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data as T;
}

const groups: {
  key: "billing" | "onboarding" | "weekly";
  title: string;
  when: string;
  templates: [Template, string][];
}[] = [
  {
    key: "billing",
    title: "Cobrança da mensalidade",
    when: "3 dias antes, no dia do vencimento e se atrasar (até 7 dias). Junto com o aviso no WhatsApp.",
    templates: [["billing", "Cobrança"]],
  },
  {
    key: "onboarding",
    title: "Boas-vindas de quem se inscreveu",
    when: "No dia do cadastro, no 2º e no 5º dia: primeiros passos, conferir a página e divulgar o link.",
    templates: [
      ["welcome", "Dia 0 · Boas-vindas"],
      ["setup", "Dia 2 · Conferir a página"],
      ["share", "Dia 5 · Divulgar"],
    ],
  },
  {
    key: "weekly",
    title: "Relatório semanal",
    when: "Toda segunda, às 9h, com o PDF da semana anterior em anexo. O dono pode desligar no painel dele.",
    templates: [["weekly", "Relatório"]],
  },
];

const kindLabel: Record<string, string> = {
  billing: "Cobrança",
  welcome: "Boas-vindas",
  setup: "Conferir página",
  share: "Divulgar",
  weekly: "Relatório",
  test: "Teste",
  campaign: "Escrito com IA",
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/** /admin → E-mails: liga, desliga, mostra a prévia e o que já saiu. */
export function EmailPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Template | null>(null);
  const [replyTo, setReplyTo] = useState("");
  const [html, setHtml] = useState<{ kind: Template; html: string } | null>(null);
  useEffect(() => {
    if (!preview) return;
    let alive = true;
    fetch(`/api/admin/emails/preview/${preview}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("preview"))))
      .then((value) => alive && setHtml({ kind: preview, html: value }))
      .catch(() => alive && setHtml({ kind: preview, html: "<p style='font-family:sans-serif;padding:24px'>Não foi possível carregar a prévia.</p>" }));
    return () => {
      alive = false;
    };
  }, [preview]);

  const load = useCallback(async () => {
    try {
      const next = await api<Overview>();
      setData(next);
      setReplyTo(next.settings.replyTo);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar.");
    }
  }, []);
  useEffect(() => {
    let alive = true;
    api<Overview>()
      .then((next) => {
        if (!alive) return;
        setData(next);
        setReplyTo(next.settings.replyTo);
      })
      .catch((cause) => alive && setError(cause instanceof Error ? cause.message : "Não foi possível carregar."));
    return () => {
      alive = false;
    };
  }, []);

  async function save(patch: Partial<Settings>) {
    if (!data) return;
    setBusy("settings");
    setNotice("");
    setError("");
    try {
      const settings = await api<Settings>("POST", { kind: "settings", ...data.settings, ...patch });
      setData({ ...data, settings });
      if (patch.replyTo !== undefined) setNotice("E-mail de resposta salvo.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy("");
    }
  }

  async function test(template: Template) {
    setBusy(`test-${template}`);
    setNotice("");
    setError("");
    try {
      const { to } = await api<{ to: string }>("POST", { kind: "test", template });
      setNotice(`Teste enviado para ${to}. Confira a caixa de entrada (e o spam).`);
      void load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "O teste não saiu.");
    } finally {
      setBusy("");
    }
  }

  if (!data) return <p className="pf-empty">{error || "Carregando os e-mails…"}</p>;
  const s = data.settings;
  const live = data.configured && s.enabled;
  const state = !data.configured ? "off" : s.enabled ? "on" : "off";
  const total = Object.values(data.counts).reduce(
    (sum, c) => ({ sent: sum.sent + c.sent, failed: sum.failed + c.failed }),
    { sent: 0, failed: 0 },
  );

  return (
    <div className="em">
      {data.demo && (
        <p className="mk-note">Na demonstração local os e-mails só mostram a tela. Eles saem no app publicado.</p>
      )}
      <section className={`pf-ai is-${state}`} aria-labelledby="em-title">
        <span className="pf-ai-icon" aria-hidden="true">
          <EnvelopeSimple size={24} weight="duotone" />
        </span>
        <div className="pf-ai-text">
          <div className="pf-ai-head">
            <h2 id="em-title">E-mails para os clientes</h2>
            <span className="pf-ai-badge" role="status">
              <i aria-hidden="true" />
              {!data.configured ? "Falta a chave do Resend" : s.enabled ? "Ligados" : "Desligados"}
            </span>
          </div>
          <p>
            {!data.configured
              ? "Cadastre a RESEND_API_KEY na Vercel e verifique o domínio no Resend. Até lá, nenhum e-mail sai."
              : s.enabled
                ? `Saindo de ${data.from} para o e-mail de login do dono de cada barbearia.`
                : "Nenhum e-mail automático sai agora. Os avisos no WhatsApp continuam."}{" "}
            <span>Últimos 30 dias: {total.sent} enviados{total.failed ? `, ${total.failed} com falha` : ""}.</span>
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={s.enabled}
          aria-labelledby="em-title"
          className="pf-ai-switch"
          onClick={() => void save({ enabled: !s.enabled })}
          disabled={busy !== "" || data.demo}
        >
          <span className="pf-ai-track">
            <span className="pf-ai-thumb" />
          </span>
          <span className="pf-ai-label">{busy === "settings" ? "Salvando…" : s.enabled ? "Desligar" : "Ligar"}</span>
        </button>
      </section>

      {(error || notice) && (
        <p className={error ? "em-alert is-error" : "em-alert"} role="status">
          {error ? <WarningCircle size={16} /> : <CheckCircle size={16} />} {error || notice}
        </p>
      )}

      <EmailComposer
        disabled={data.demo}
        configured={data.configured}
        onSent={(message) => {
          setError("");
          setNotice(message);
          void load();
        }}
      />

      <div className="em-grid">
        {groups.map((group) => {
          const on = s[group.key];
          const count = group.templates.reduce(
            (sum, [t]) => sum + (data.counts[t]?.sent || 0),
            0,
          );
          return (
            <section key={group.key} className={`pf-panel em-card ${on && live ? "is-live" : ""}`}>
              <div className="em-card-head">
                <div>
                  <h3>{group.title}</h3>
                  <p>{group.when}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${group.title}: ${on ? "ligado" : "desligado"}`}
                  className="em-switch"
                  disabled={busy !== "" || data.demo}
                  onClick={() => void save({ [group.key]: !on })}
                >
                  <span />
                </button>
              </div>
              <span className="em-count">{count} enviados nos últimos 30 dias</span>
              <ul className="em-templates">
                {group.templates.map(([template, label]) => (
                  <li key={template}>
                    <span>{label}</span>
                    <button
                      type="button"
                      className="em-link"
                      aria-pressed={preview === template}
                      onClick={() => setPreview(preview === template ? null : template)}
                    >
                      <Eye size={15} /> {preview === template ? "Fechar" : "Prévia"}
                    </button>
                    <button
                      type="button"
                      className="em-link"
                      disabled={busy !== "" || !data.configured || data.demo}
                      onClick={() => void test(template)}
                    >
                      <PaperPlaneTilt size={15} /> {busy === `test-${template}` ? "Enviando…" : "Testar em mim"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {preview && (
        <section className="pf-panel em-preview">
          <div className="em-card-head">
            <h3>Prévia · {kindLabel[preview]}</h3>
            <button type="button" className="em-link" onClick={() => setPreview(null)}>
              Fechar
            </button>
          </div>
          <iframe
            title={`Prévia do e-mail ${kindLabel[preview]}`}
            srcDoc={html?.kind === preview ? html.html : ""}
            sandbox=""
          />
          <p className="em-hint">Dados de exemplo. No envio de verdade entram o nome, o plano e o link de cada barbearia.</p>
        </section>
      )}

      <section className="pf-panel em-reply">
        <h3>Respostas dos clientes</h3>
        <p>Quando o dono responde um e-mail, a resposta vai para este endereço. Deixe vazio para não receber.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save({ replyTo: replyTo.trim() });
          }}
        >
          <input
            type="email"
            placeholder="contato@studioflowapp.tech"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            aria-label="E-mail que recebe as respostas"
            disabled={data.demo}
          />
          <button
            type="submit"
            className="mk-primary"
            disabled={busy !== "" || data.demo || replyTo.trim() === s.replyTo}
          >
            Salvar
          </button>
        </form>
      </section>

      <section className="pf-panel em-log">
        <h3>Últimos envios</h3>
        {data.recent.length ? (
          <ul>
            {data.recent.map((row) => (
              <li key={row.id} className={row.status === "failed" ? "is-failed" : ""}>
                <span className="em-tag">{kindLabel[row.kind] || row.kind}</span>
                <span className="em-log-main">
                  <b>{row.subject}</b>
                  <small>
                    {row.recipient}
                    {row.status === "failed" ? ` · falhou${row.error ? `: ${row.error}` : ""}` : ""}
                  </small>
                </span>
                <time>{when(row.createdAt)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pf-panel-empty">Nenhum e-mail enviado ainda.</p>
        )}
      </section>
    </div>
  );
}
