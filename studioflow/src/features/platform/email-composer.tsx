"use client";

import { useEffect, useState } from "react";
import { Eye, PaperPlaneTilt, Sparkle } from "@phosphor-icons/react/dist/ssr";

type Cta = "none" | "painel" | "divulgar" | "configuracoes" | "agenda";
interface Draft {
  subject: string;
  title: string;
  body: string;
  cta: Cta;
  ctaLabel: string;
}

async function call<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/admin/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data as T;
}

const ctaOptions: [Cta, string][] = [
  ["none", "Sem botão"],
  ["painel", "Painel"],
  ["divulgar", "Aba Divulgar"],
  ["configuracoes", "Configurações"],
  ["agenda", "Agenda"],
];

/** Escrever com IA: o admin pede, a IA escreve, o admin revisa e envia. */
export function EmailComposer({
  disabled,
  configured,
  onSent,
}: {
  disabled: boolean;
  configured: boolean;
  onSent: (message: string) => void;
}) {
  const [brief, setBrief] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [html, setHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [audience, setAudience] = useState<"me" | "active" | "one">("me");
  const [businessId, setBusinessId] = useState("");
  const [people, setPeople] = useState<{ active: number; businesses: { id: string; name: string; email: string }[] } | null>(null);

  useEffect(() => {
    if (!draft || people) return;
    let alive = true;
    call<{ active: number; businesses: { id: string; name: string; email: string }[] }>({ kind: "audience" })
      .then((value) => alive && setPeople(value))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [draft, people]);

  async function generate() {
    setBusy("draft");
    setError("");
    try {
      setDraft(await call<Draft>({ kind: "draft", brief }));
      setShowPreview(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A IA não respondeu.");
    } finally {
      setBusy("");
    }
  }

  async function preview() {
    if (!draft) return;
    setBusy("preview");
    setError("");
    try {
      const { html } = await call<{ html: string }>({ kind: "preview", ...draft });
      setHtml(html);
      setShowPreview(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Confira os campos do e-mail.");
    } finally {
      setBusy("");
    }
  }

  async function send() {
    if (!draft) return;
    const count =
      audience === "me" ? 1 : audience === "one" ? 1 : people?.active ?? 0;
    const who =
      audience === "me"
        ? "o seu e-mail (teste)"
        : audience === "one"
          ? people?.businesses.find((b) => b.id === businessId)?.name || "a barbearia escolhida"
          : `${count} barbearias ativas`;
    if (audience !== "me" && !window.confirm(`Enviar este e-mail para ${who}? Não dá para desfazer.`)) return;
    setBusy("send");
    setError("");
    try {
      const result = await call<{ sent: number; failed: number; to?: string }>({
        kind: "send",
        ...draft,
        audience,
        ...(audience === "one" ? { businessId } : {}),
      });
      onSent(
        audience === "me"
          ? `Teste enviado para ${result.to}.`
          : `Enviado para ${result.sent} ${result.sent === 1 ? "barbearia" : "barbearias"}${result.failed ? `, ${result.failed} com falha` : ""}.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "O envio não saiu.");
    } finally {
      setBusy("");
    }
  }

  const set = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });

  return (
    <section className="pf-panel em-compose">
      <div className="em-card-head">
        <div>
          <h3>
            <Sparkle size={17} /> Escrever com IA
          </h3>
          <p>Diga o que quer comunicar. A IA escreve, você revisa e escolhe para quem vai.</p>
        </div>
      </div>
      <textarea
        rows={3}
        maxLength={1500}
        placeholder="Ex.: avisar que agora dá para postar no Instagram direto pela aba Divulgar, e chamar para testar hoje."
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        disabled={disabled}
        aria-label="O que você quer comunicar"
      />
      <div className="em-actions">
        <button
          type="button"
          className="mk-primary"
          disabled={disabled || busy !== "" || brief.trim().length < 5}
          onClick={() => void generate()}
        >
          <Sparkle size={16} /> {busy === "draft" ? "Escrevendo…" : draft ? "Escrever de novo" : "Gerar com IA"}
        </button>
        <span className="em-hint">Usa a chave e o modelo do Marketing.</span>
      </div>
      {error && <em className="mk-error">{error}</em>}

      {draft && (
        <div className="em-draft">
          <label>
            Assunto
            <input value={draft.subject} maxLength={150} onChange={(e) => set({ subject: e.target.value })} />
          </label>
          <label>
            Título
            <input value={draft.title} maxLength={150} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label>
            Texto <small>{"{nome}"} e {"{barbearia}"} viram o nome de cada dono e da casa. Linha em branco separa parágrafos.</small>
            <textarea rows={8} maxLength={4000} value={draft.body} onChange={(e) => set({ body: e.target.value })} />
          </label>
          <div className="em-row">
            <label>
              Botão leva para
              <select value={draft.cta} onChange={(e) => set({ cta: e.target.value as Cta })}>
                {ctaOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {draft.cta !== "none" && (
              <label>
                Texto do botão
                <input value={draft.ctaLabel} maxLength={60} onChange={(e) => set({ ctaLabel: e.target.value })} />
              </label>
            )}
          </div>
          <div className="em-row">
            <label>
              Para quem
              <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
                <option value="me">Só para mim (teste)</option>
                <option value="active">
                  Todas as barbearias ativas{people ? ` (${people.active})` : ""}
                </option>
                <option value="one">Uma barbearia</option>
              </select>
            </label>
            {audience === "one" && (
              <label>
                Barbearia
                <select value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {(people?.businesses || []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.email}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="em-actions">
            <button type="button" className="mk-ghost" disabled={busy !== ""} onClick={() => void preview()}>
              <Eye size={16} /> {busy === "preview" ? "Montando…" : "Ver prévia"}
            </button>
            <button
              type="button"
              className="mk-primary"
              disabled={disabled || !configured || busy !== "" || (audience === "one" && !businessId)}
              onClick={() => void send()}
            >
              <PaperPlaneTilt size={16} /> {busy === "send" ? "Enviando…" : audience === "me" ? "Enviar teste para mim" : "Enviar"}
            </button>
          </div>
          {showPreview && (
            <iframe title="Prévia do e-mail escrito com IA" srcDoc={html} sandbox="" className="em-frame" />
          )}
        </div>
      )}
    </section>
  );
}
