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

interface Person {
  id: string;
  name: string;
  owner: string;
  email: string;
  active: boolean;
}

/** Escrever com IA: o admin pede, a IA escreve, escolhe os e-mails e envia. */
export function EmailComposer({
  ai,
  disabled,
  configured,
  onSent,
}: {
  ai: boolean;
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
  const [people, setPeople] = useState<Person[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    call<{ businesses: Person[] }>({ kind: "audience" })
      .then((value) => alive && setPeople(value.businesses))
      .catch(() => alive && setPeople([]));
    return () => {
      alive = false;
    };
  }, []);

  async function generate() {
    if (brief.trim().length < 5) {
      setError("Escreva primeiro, no campo acima, o que você quer comunicar. Ex.: avisar sobre a novidade da aba Divulgar.");
      return;
    }
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

  async function send(audience: "me" | "list") {
    if (!draft) return;
    if (audience === "list") {
      const names = (people || []).filter((p) => selected.includes(p.id));
      const who = names.length === 1 ? `${names[0].name} (${names[0].email})` : `${names.length} e-mails`;
      if (!window.confirm(`Enviar este e-mail para ${who}? Não dá para desfazer.`)) return;
    }
    setBusy(audience);
    setError("");
    try {
      const result = await call<{ sent: number; failed: number; to?: string }>({
        kind: "send",
        ...draft,
        audience,
        businessIds: audience === "list" ? selected : [],
      });
      onSent(
        audience === "me"
          ? `Teste enviado para ${result.to}.`
          : `Enviado para ${result.sent} ${result.sent === 1 ? "e-mail" : "e-mails"}${result.failed ? `, ${result.failed} com falha` : ""}.`,
      );
      if (audience === "list") setSelected([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "O envio não saiu.");
    } finally {
      setBusy("");
    }
  }

  const set = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });
  const list = people || [];
  const term = search.trim().toLowerCase();
  const shown = term
    ? list.filter((p) => `${p.name} ${p.owner} ${p.email}`.toLowerCase().includes(term))
    : list;
  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const allOn = list.length > 0 && selected.length === list.length;

  return (
    <section className="pf-panel em-compose">
      <div className="em-card-head">
        <div>
          <h3>
            <Sparkle size={17} /> Escrever com IA
          </h3>
          <p>Diga o que quer comunicar. A IA escreve, você revisa e escolhe os e-mails que recebem.</p>
        </div>
      </div>
      <textarea
        rows={3}
        maxLength={1500}
        placeholder="Ex.: avisar que agora dá para postar no Instagram direto pela aba Divulgar, e chamar para testar hoje."
        value={brief}
        onChange={(e) => {
          setBrief(e.target.value);
          if (error) setError("");
        }}
        disabled={disabled}
        aria-label="O que você quer comunicar"
      />
      <div className="em-actions">
        <button
          type="button"
          className="mk-primary"
          disabled={disabled || !ai || busy !== ""}
          onClick={() => void generate()}
        >
          <Sparkle size={16} /> {busy === "draft" ? "Escrevendo…" : draft ? "Escrever de novo" : "Gerar com IA"}
        </button>
        <span className="em-hint">
          {ai ? "Usa a chave da IA dos e-mails." : "Salve a chave da IA dos e-mails no quadro acima para gerar."}
        </span>
        {!draft && (
          <button
            type="button"
            className="em-link"
            disabled={disabled}
            onClick={() => setDraft({ subject: "", title: "", body: "Oi, {nome}!\n\n", cta: "painel", ctaLabel: "" })}
          >
            Escrever sem IA
          </button>
        )}
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
          <div className="em-actions">
            <button type="button" className="mk-ghost" disabled={busy !== ""} onClick={() => void preview()}>
              <Eye size={16} /> {busy === "preview" ? "Montando…" : "Ver prévia"}
            </button>
            <button
              type="button"
              className="mk-ghost"
              disabled={disabled || !configured || busy !== ""}
              onClick={() => void send("me")}
            >
              <PaperPlaneTilt size={16} /> {busy === "me" ? "Enviando…" : "Enviar teste para mim"}
            </button>
          </div>
          {showPreview && (
            <iframe title="Prévia do e-mail" srcDoc={html} sandbox="" className="em-frame" />
          )}
        </div>
      )}

      <div className="em-people">
        <div className="em-people-head">
          <strong>E-mails cadastrados</strong>
          <span>{selected.length} de {list.length} marcados</span>
        </div>
        <div className="em-people-tools">
          <input
            type="search"
            placeholder="Buscar barbearia, dono ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar e-mail"
          />
          <button
            type="button"
            className="em-link"
            disabled={!list.length}
            onClick={() => setSelected(allOn ? [] : list.map((p) => p.id))}
          >
            {allOn ? "Desmarcar todos" : `Marcar todos (${list.length})`}
          </button>
          <button
            type="button"
            className="em-link"
            disabled={!list.length}
            onClick={() => setSelected(list.filter((p) => p.active).map((p) => p.id))}
          >
            Só ativas
          </button>
        </div>
        {people === null ? (
          <p className="em-hint">Carregando os e-mails…</p>
        ) : shown.length ? (
          <ul className="em-people-list">
            {shown.map((p) => (
              <li key={p.id}>
                <label>
                  <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                  <span>
                    <b>{p.name}</b>
                    <small>
                      {p.owner ? `${p.owner} · ` : ""}
                      {p.email}
                    </small>
                  </span>
                  {!p.active && <i className="em-tag">inativa</i>}
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="em-hint">{list.length ? "Nenhum e-mail com essa busca." : "Nenhum e-mail cadastrado ainda."}</p>
        )}
        <div className="em-actions">
          <button
            type="button"
            className="mk-primary"
            disabled={disabled || !configured || !draft || busy !== "" || !selected.length}
            onClick={() => void send("list")}
          >
            <PaperPlaneTilt size={16} />{" "}
            {busy === "list"
              ? "Enviando…"
              : selected.length
                ? `Enviar para ${selected.length} ${selected.length === 1 ? "e-mail" : "e-mails"}`
                : "Marque quem recebe"}
          </button>
          {!draft && <span className="em-hint">Escreva o e-mail acima antes de enviar.</span>}
        </div>
      </div>
    </section>
  );
}
