"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  ChatCircleText,
  InstagramLogo,
  MagnifyingGlass,
  MapPin,
  Sparkle,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import {
  formatLeadPhone,
  isMobile,
  leadStatuses,
  whatsappLink,
  type LeadStatus,
} from "@/services/leads/lead-logic";
import type { Lead, LeadsView } from "@/services/leads/service";
import "./marketing.css";
import "./leads.css";

async function call<T>(body?: unknown): Promise<T> {
  const response = await fetch("/api/admin/leads", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível.");
  return data as T;
}

const statusLabel = Object.fromEntries(leadStatuses.map((item) => [item.id, item.label])) as Record<
  LeadStatus,
  string
>;

type Tab = "open" | "today" | "new" | "contacted" | "replied" | "trial" | "done" | "out";
const tabs: [Tab, string][] = [
  ["open", "Abertos"],
  ["today", "Retornar hoje"],
  ["new", "Novos"],
  ["contacted", "Mensagem enviada"],
  ["replied", "Responderam"],
  ["trial", "Em teste"],
  ["done", "Clientes"],
  ["out", "Fora"],
];

function inTab(lead: Lead, tab: Tab, now: number) {
  switch (tab) {
    case "open":
      return !["customer", "lost", "opted_out"].includes(lead.status);
    case "today":
      return (
        !!lead.followUpAt &&
        Date.parse(lead.followUpAt) <= now &&
        ["contacted", "replied", "demo"].includes(lead.status)
      );
    case "new":
      return lead.status === "new";
    case "contacted":
      return lead.status === "contacted";
    case "replied":
      return lead.status === "replied" || lead.status === "demo";
    case "trial":
      return lead.status === "trial";
    case "done":
      return lead.status === "customer";
    case "out":
      return lead.status === "lost" || lead.status === "opted_out";
  }
}

/** Captação: ache barbearias, veja por que valem a pena e fale com o dono. */
export function LeadsPanel() {
  const [view, setViewState] = useState<LeadsView | null>(null);
  // "Agora" de quando a lista chegou: os retornos de hoje são contados nele.
  const [now, setNow] = useState(0);
  const setView = (next: LeadsView) => {
    setViewState(next);
    setNow(Date.now());
  };
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("open");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    let alive = true;
    call<LeadsView>()
      .then((next) => {
        if (!alive) return;
        setViewState(next);
        setNow(Date.now());
      })
      .catch((cause) => alive && setError(cause instanceof Error ? cause.message : "Não foi possível carregar."));
    return () => {
      alive = false;
    };
  }, []);
  async function act(key: string, body: Record<string, unknown>, done?: (result: Record<string, unknown>) => void) {
    setBusy(key);
    setError("");
    setNote("");
    try {
      const result = await call<Record<string, unknown> & { view: LeadsView }>(body);
      setView(result.view);
      done?.(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy("");
    }
  }
  const list = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (view?.leads || [])
      .filter(
        (lead) =>
          inTab(lead, tab, now) &&
          (!term || `${lead.name} ${lead.city} ${lead.address} ${lead.instagram}`.toLowerCase().includes(term)),
      )
      .sort((a, b) =>
        tab === "today"
          ? Date.parse(a.followUpAt || "") - Date.parse(b.followUpAt || "")
          : b.score - a.score || a.name.localeCompare(b.name, "pt-BR"),
      );
  }, [view, tab, query, now]);
  if (!view) return <p className="pf-empty">{error || "Carregando a Captação…"}</p>;
  const pending = view.leads.filter((lead) => !lead.profiledAt && lead.website).length;
  const funnel: [string, number][] = [
    ["Novos", view.counts.new],
    ["Contatadas", view.counts.contacted],
    ["Responderam", view.counts.replied + view.counts.demo],
    ["Em teste grátis", view.counts.trial],
    ["Clientes", view.counts.customer],
  ];
  return (
    <div className="mk ld">
      {view.demo && (
        <p className="mk-note">
          Na demonstração local a busca traz barbearias inventadas, sem gastar nada. No app publicado ela usa o Google Maps.
        </p>
      )}
      <section className="pf-panel ld-funnel" aria-label="Funil">
        {funnel.map(([label, value]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
        <button type="button" className={`ld-today ${view.dueFollowUps ? "is-due" : ""}`} onClick={() => setTab("today")}>
          <b>{view.dueFollowUps}</b> para retornar hoje
        </button>
      </section>

      <div className="ld-top">
        <SearchCard view={view} busy={busy} onSearch={(body, done) => void act("search", body, done)} />
        <SettingsCard view={view} busy={busy} onSave={(body) => void act("settings", body, () => setNote("Salvo."))} />
      </div>
      {error && <p className="mk-alert" role="alert">{error}</p>}
      {note && <p className="mk-ok">{note}</p>}

      <section className="pf-panel">
        <div className="ld-list-head">
          <div className="mk-tabs" role="tablist" aria-label="Leads">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? "is-current" : ""}
                onClick={() => setTab(id)}
              >
                {label}
                <span>{(view.leads || []).filter((lead) => inTab(lead, id, now)).length}</span>
              </button>
            ))}
          </div>
          <div className="ld-tools">
            <label className="ld-filter">
              <MagnifyingGlass size={15} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar por nome, bairro, @" />
            </label>
            {pending > 0 && (
              <button type="button" className="mk-ghost" disabled={!!busy} onClick={() => void act("pending", { kind: "profilePending" })}>
                {busy === "pending" ? "Investigando…" : `Investigar ${pending} sites`}
              </button>
            )}
            <ManualLead busy={busy} onAdd={(body, done) => void act("manual", body, done)} />
          </div>
        </div>
        {list.length ? (
          <div className="ld-cards">
            {list.map((lead) => (
              <LeadCard key={`${lead.id}:${lead.message}`} lead={lead} now={now} busy={busy} act={act} />
            ))}
          </div>
        ) : (
          <p className="pf-panel-empty">
            {view.leads.length
              ? "Nada nesta lista."
              : "Busque uma cidade acima para começar. As barbearias aparecem aqui com nota e o motivo."}
          </p>
        )}
      </section>
    </div>
  );
}

function SearchCard({
  view,
  busy,
  onSearch,
}: {
  view: LeadsView;
  busy: string;
  onSearch: (body: Record<string, unknown>, done: (result: Record<string, unknown>) => void) => void;
}) {
  const [city, setCity] = useState("");
  const [term, setTerm] = useState("barbearia");
  const [provider, setProvider] = useState<"serper" | "openstreetmap">(view.settings.serper || view.demo ? "serper" : "openstreetmap");
  const [pages, setPages] = useState(1);
  const [result, setResult] = useState("");
  return (
    <section className="pf-panel ld-search">
      <h2>Achar barbearias</h2>
      <p className="mk-muted">
        Cidade e, se quiser, o bairro. A StudioFlow lê o site de cada casa e dá uma nota de 0 a 100.
      </p>
      <form
        className="ld-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          setResult("");
          onSearch({ kind: "search", city, term, provider, pages }, (data) =>
            setResult(`${data.found} encontradas, ${data.added} novas na lista.`),
          );
        }}
      >
        <label>
          Cidade
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Goiânia" required minLength={2} />
        </label>
        <label>
          Procurar
          <input value={term} onChange={(e) => setTerm(e.target.value)} minLength={3} />
        </label>
        <label>
          Fonte
          <select value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)}>
            <option value="serper">Google Maps{view.settings.serper || view.demo ? "" : " (falta a chave)"}</option>
            <option value="openstreetmap">OpenStreetMap (grátis)</option>
          </select>
        </label>
        {provider === "serper" && (
          <label>
            Quantas
            <select value={pages} onChange={(e) => setPages(Number(e.target.value))}>
              <option value={1}>Até 20</option>
              <option value={2}>Até 40</option>
              <option value={3}>Até 60</option>
            </select>
          </label>
        )}
        <button className="mk-primary" type="submit" disabled={!!busy || city.trim().length < 2}>
          <MagnifyingGlass size={16} /> {busy === "search" ? "Buscando e lendo os sites…" : "Buscar"}
        </button>
      </form>
      {result && <p className="mk-ok">{result}</p>}
    </section>
  );
}

function SettingsCard({
  view,
  busy,
  onSave,
}: {
  view: LeadsView;
  busy: string;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const [sender, setSender] = useState(view.settings.senderName);
  const [key, setKey] = useState("");
  return (
    <section className="pf-panel ld-settings">
      <h2>Fonte e assinatura</h2>
      <label className="mk-block">
        Seu nome na mensagem
        <span className="mk-inline">
          <input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="Ex.: Matheus" maxLength={60} />
          <button type="button" className="mk-ghost" disabled={!!busy || sender === view.settings.senderName} onClick={() => onSave({ kind: "settings", senderName: sender })}>
            Salvar
          </button>
        </span>
      </label>
      <div className="mk-block">
        <span>
          Google Maps pela Serper{" "}
          {view.settings.serper ? (
            <b className="ld-ok">conectada · final {view.settings.hint}</b>
          ) : (
            <b className="ld-warn">sem chave</b>
          )}
        </span>
        {view.settings.serper !== "environment" && !view.demo && (
          <span className="mk-inline">
            <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Cole a chave da Serper" />
            <button type="button" className="mk-ghost" disabled={!!busy || key.trim().length < 20} onClick={() => { onSave({ kind: "settings", serperKey: key.trim() }); setKey(""); }}>
              {busy === "settings" ? "Conferindo…" : "Conectar"}
            </button>
          </span>
        )}
        <small className="mk-muted">
          Crie grátis em <a href="https://serper.dev" target="_blank" rel="noopener noreferrer">serper.dev</a>: 2.500 buscas de cortesia. {view.settings.searches} usadas aqui.
        </small>
      </div>
      <small className="mk-muted">
        A mensagem é escrita pela IA do Marketing{view.settings.ai ? "" : " (sem chave: sai um texto pronto)"}. Quem envia é você, pelo seu WhatsApp.
      </small>
    </section>
  );
}

function ManualLead({
  busy,
  onAdd,
}: {
  busy: string;
  onAdd: (body: Record<string, unknown>, done: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", instagram: "", city: "" });
  if (!open)
    return (
      <button type="button" className="mk-ghost" onClick={() => setOpen(true)}>
        + Adicionar
      </button>
    );
  return (
    <form
      className="ld-manual"
      onSubmit={(event) => {
        event.preventDefault();
        onAdd({ kind: "manual", ...form }, () => {
          setForm({ name: "", phone: "", instagram: "", city: "" });
          setOpen(false);
        });
      }}
    >
      <input required minLength={2} placeholder="Nome da barbearia" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input placeholder="WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <input placeholder="@instagram" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
      <input placeholder="Cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
      <button className="mk-primary" type="submit" disabled={!!busy}>Adicionar</button>
      <button className="mk-ghost" type="button" onClick={() => setOpen(false)}>Cancelar</button>
    </form>
  );
}

function LeadCard({
  lead,
  now,
  busy,
  act,
}: {
  lead: Lead;
  now: number;
  busy: string;
  act: (key: string, body: Record<string, unknown>, done?: (result: Record<string, unknown>) => void) => Promise<void>;
}) {
  const [message, setMessage] = useState(lead.message);
  const [notes, setNotes] = useState(lead.notes);
  const [open, setOpen] = useState(false);
  const out = lead.status === "opted_out";
  const canWhatsApp = !out && isMobile(lead.phone);
  const tone = lead.score >= 70 ? "is-hot" : lead.score >= 45 ? "is-warm" : "";
  const due = lead.followUpAt && Date.parse(lead.followUpAt) <= now && ["contacted", "replied", "demo"].includes(lead.status);
  return (
    <article className={`ld-card ${out ? "is-out" : ""}`}>
      <header>
        <span className={`ld-score ${tone}`} title="Nota da Captação">{lead.score}</span>
        <div>
          <strong>{lead.name}</strong>
          <small>
            {[lead.address || lead.city, lead.rating ? `${lead.rating.toFixed(1).replace(".", ",")}★` : "", lead.reviews ? `${lead.reviews} avaliações` : ""]
              .filter(Boolean)
              .join(" · ")}
          </small>
        </div>
        <select
          value={lead.status}
          aria-label="Situação"
          disabled={!!busy}
          onChange={(e) => {
            const status = e.target.value;
            if (status === "opted_out" && !window.confirm("Ela não vai mais aparecer para receber mensagem. Confirmar?")) return;
            void act(`status-${lead.id}`, { kind: "update", id: lead.id, status });
          }}
        >
          {leadStatuses.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </header>
      <ul className="ld-reasons">
        {lead.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
        {due && <li className="is-due">Retornar hoje</li>}
      </ul>
      <div className="ld-links">
        {lead.phone && <span><WhatsAppIcon size={14} /> {formatLeadPhone(lead.phone)}</span>}
        {lead.instagram && (
          <a href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noopener noreferrer">
            <InstagramLogo size={14} /> @{lead.instagram}
          </a>
        )}
        {lead.website && (
          <a href={/^https?:/i.test(lead.website) ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer nofollow">
            <ArrowSquareOut size={14} /> site
          </a>
        )}
        {lead.mapsUrl && (
          <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer">
            <MapPin size={14} /> mapa
          </a>
        )}
        {lead.contactedAt && <span>Mensagem em {new Date(lead.contactedAt).toLocaleDateString("pt-BR")}</span>}
      </div>
      {out ? (
        <p className="mk-muted">Pediu para não receber mensagens. Nada mais é enviado para esta barbearia.</p>
      ) : (
        <>
          {(message || open) && (
            <textarea
              rows={9}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onBlur={() => message !== lead.message && void act(`msg-${lead.id}`, { kind: "update", id: lead.id, message })}
              aria-label="Mensagem"
            />
          )}
          <div className="mk-actions">
            <button type="button" className="mk-ghost" disabled={!!busy} onClick={() => void act(`draft-${lead.id}`, { kind: "draft", id: lead.id }, () => setOpen(true))}>
              <Sparkle size={15} /> {busy === `draft-${lead.id}` ? "Escrevendo…" : message ? "Escrever de novo" : "Escrever mensagem"}
            </button>
            {canWhatsApp ? (
              <a
                className={`mk-primary ld-wa ${message ? "" : "is-disabled"}`}
                href={message ? whatsappLink(lead.phone, message) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!message}
                title={message ? undefined : "Escreva a mensagem primeiro"}
                onClick={(event) => {
                  if (!message) return event.preventDefault();
                  void act(`sent-${lead.id}`, { kind: "contacted", id: lead.id });
                }}
              >
                <WhatsAppIcon size={15} /> Abrir no WhatsApp
              </a>
            ) : lead.instagram ? (
              <a className="mk-primary" href={`https://ig.me/m/${lead.instagram}`} target="_blank" rel="noopener noreferrer" onClick={() => message && void navigator.clipboard?.writeText(message).catch(() => undefined)}>
                <ChatCircleText size={15} /> Copiar e abrir o direct
              </a>
            ) : (
              <span className="mk-muted">{lead.phone ? "Telefone fixo: ligue ou procure o Instagram." : "Sem contato direto."}</span>
            )}
            {lead.website && !lead.profiledAt && (
              <button type="button" className="mk-ghost" disabled={!!busy} onClick={() => void act(`profile-${lead.id}`, { kind: "profile", id: lead.id })}>
                <Star size={15} /> Investigar site
              </button>
            )}
            {lead.contactedAt && (
              <button type="button" className="pf-text-button" disabled={!!busy} onClick={() => void act(`fu-${lead.id}`, { kind: "update", id: lead.id, followUpDays: 3 })}>
                Lembrar em 3 dias
              </button>
            )}
          </div>
          <details className="ld-notes">
            <summary>Anotações{lead.notes ? " ✓" : ""}</summary>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== lead.notes && void act(`notes-${lead.id}`, { kind: "update", id: lead.id, notes })}
              placeholder="O que ele respondeu, melhor horário, quem é o dono…"
            />
          </details>
        </>
      )}
      <footer className="ld-status">{statusLabel[lead.status]}</footer>
    </article>
  );
}
