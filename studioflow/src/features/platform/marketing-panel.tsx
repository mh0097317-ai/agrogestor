"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  CalendarBlank,
  ChatCircle,
  Heart,
  InstagramLogo,
  PaperPlaneTilt,
  Sparkle,
  Trash,
  UploadSimple,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr";
import type {
  MarketingPost,
  MarketingSettings,
  Slide,
} from "@/services/marketing/content";
import "./marketing.css";

interface State {
  account: { username: string } | null;
  settings: MarketingSettings;
  posts: MarketingPost[];
  ai: boolean;
  demo: boolean;
}

async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível.");
  return data as T;
}

const tabs = [
  ["draft", "Aguardando aprovação"],
  ["scheduled", "Agendados"],
  ["published", "Publicados"],
  ["failed", "Com erro"],
] as const;
type Tab = (typeof tabs)[number][0];

const formatLabel: Record<MarketingPost["format"], string> = {
  post: "Post",
  carousel: "Carrossel",
  story: "Story",
  reel: "Reel",
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/** datetime-local (horário de Brasília) ↔ ISO. */
function toLocalInput(iso: string | null) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 86_400_000);
  return new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 16);
}
const fromLocalInput = (value: string) => new Date(`${value}:00-03:00`).toISOString();

/**
 * Modo Marketing: a IA cria posts, carrosséis e stories para o Instagram da
 * StudioFlow; a equipe aprova (ou liga o piloto automático) e o servidor publica.
 */
export function MarketingPanel() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("draft");
  const load = useCallback(async () => {
    try {
      setState(await api<State>("/api/admin/marketing"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar.");
    }
  }, []);
  useEffect(() => {
    let alive = true;
    api<State>("/api/admin/marketing")
      .then((next) => alive && setState(next))
      .catch((cause) => alive && setError(cause instanceof Error ? cause.message : "Não foi possível carregar."));
    return () => {
      alive = false;
    };
  }, []);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of state?.posts || []) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [state]);
  const replace = (post: MarketingPost) =>
    setState((s) =>
      s ? { ...s, posts: s.posts.map((p) => (p.id === post.id ? post : p)).filter((p) => p.status !== "discarded") } : s,
    );
  if (!state)
    return <p className="pf-empty">{error || "Carregando o Marketing…"}</p>;
  const list = state.posts
    .filter((p) => (tab === "failed" ? p.status === "failed" : tab === "scheduled" ? ["scheduled", "publishing"].includes(p.status) : p.status === tab))
    .sort((a, b) =>
      tab === "scheduled"
        ? (a.scheduledFor || "").localeCompare(b.scheduledFor || "")
        : b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <div className="mk">
      {state.demo && (
        <p className="mk-note">Na demonstração local o Marketing só mostra a tela. Ele funciona no app publicado.</p>
      )}
      {!state.ai && (
        <p className="mk-note">A IA não está configurada no servidor (ANTHROPIC_API_KEY). Sem ela dá para publicar Reels, mas não criar posts.</p>
      )}
      <div className="mk-top">
        <Account state={state} onChange={load} />
        <Autopilot state={state} onSaved={(settings) => setState({ ...state, settings })} />
      </div>
      <Create
        disabled={!state.ai || state.demo}
        onCreated={(posts) => {
          setState({ ...state, posts: [...posts, ...state.posts] });
          setTab(posts[0]?.status === "scheduled" ? "scheduled" : "draft");
        }}
      />
      <section className="pf-panel">
        <div className="mk-tabs" role="tablist" aria-label="Fila de publicações">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? "is-current" : ""}
              onClick={() => setTab(key)}
            >
              {label}
              <span>{key === "scheduled" ? (counts.scheduled || 0) + (counts.publishing || 0) : counts[key] || 0}</span>
            </button>
          ))}
        </div>
        {list.length ? (
          <div className="mk-grid">
            {list.map((post) => (
              <PostCard key={post.id} post={post} connected={!!state.account} onChange={replace} />
            ))}
          </div>
        ) : (
          <p className="pf-panel-empty">
            {tab === "draft"
              ? "Nada aguardando. Peça novas ideias para a IA logo acima."
              : tab === "scheduled"
                ? "Nenhum post agendado."
                : tab === "published"
                  ? "Ainda não há posts publicados por aqui."
                  : "Nenhum erro. Tudo certo."}
          </p>
        )}
      </section>
    </div>
  );
}

function Account({ state, onChange }: { state: State; onChange: () => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/marketing", "POST", body);
      setToken("");
      onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pf-panel mk-account">
      <div className="mk-account-head">
        <InstagramLogo size={26} />
        <div>
          <strong>Instagram da StudioFlow</strong>
          <span>
            {state.account
              ? `Conectado como @${state.account.username}. Os posts aprovados saem por ele.`
              : "Cole o token do Instagram (API com login do Instagram, conta profissional). O token começa com IG."}
          </span>
        </div>
      </div>
      {state.account ? (
        <button type="button" className="pf-text-button" disabled={busy} onClick={() => void run({ kind: "disconnect" })}>
          Desconectar
        </button>
      ) : (
        <form
          className="mk-inline"
          onSubmit={(event) => {
            event.preventDefault();
            void run({ kind: "connect", token });
          }}
        >
          <input
            type="password"
            autoComplete="off"
            placeholder="IGAA…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            aria-label="Token do Instagram"
          />
          <button type="submit" className="mk-primary" disabled={busy || token.trim().length < 20 || state.demo}>
            {busy ? "Conferindo…" : "Conectar"}
          </button>
        </form>
      )}
      {error && <em className="mk-error">{error}</em>}
    </section>
  );
}

function Autopilot({ state, onSaved }: { state: State; onSaved: (s: MarketingSettings) => void }) {
  const [form, setForm] = useState(state.settings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(state.settings);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      onSaved(await api<MarketingSettings>("/api/admin/marketing", "POST", { kind: "settings", ...form }));
      setMessage("Salvo.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pf-panel mk-auto">
      <div className="pf-panel-head">
        <h2>Piloto automático</h2>
      </div>
      <label className="mk-check">
        <input type="checkbox" checked={form.autopilot} onChange={(e) => setForm({ ...form, autopilot: e.target.checked })} />
        <span>
          <b>A IA cria os posts da semana sozinha</b>
          <small>Uma vez por dia ela confere a fila e completa o que faltar.</small>
        </span>
      </label>
      <label className="mk-check">
        <input
          type="checkbox"
          checked={form.autoPublish}
          disabled={!form.autopilot}
          onChange={(e) => setForm({ ...form, autoPublish: e.target.checked })}
        />
        <span>
          <b>Publicar sem minha aprovação</b>
          <small>Desligado, os posts esperam você aprovar em “Aguardando aprovação”.</small>
        </span>
      </label>
      <div className="mk-row">
        <label>
          Posts por semana
          <input type="number" min={1} max={14} value={form.postsPerWeek} onChange={(e) => setForm({ ...form, postsPerWeek: Number(e.target.value) || 1 })} />
        </label>
        <label>
          Horário (Brasília)
          <select value={form.postHour} onChange={(e) => setForm({ ...form, postHour: Number(e.target.value) })}>
            {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
              <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="mk-block">
        Orientação para a IA
        <textarea
          rows={2}
          maxLength={1000}
          placeholder="Ex.: falar mais da recepcionista no WhatsApp; tom descontraído; nada de gírias."
          value={form.voice}
          onChange={(e) => setForm({ ...form, voice: e.target.value })}
        />
      </label>
      <div className="mk-actions">
        <button type="button" className="mk-primary" disabled={!dirty || busy || state.demo} onClick={() => void save()}>
          {busy ? "Salvando…" : "Salvar"}
        </button>
        {message && <span className="mk-muted">{message}</span>}
      </div>
    </section>
  );
}

function Create({ disabled, onCreated }: { disabled: boolean; onCreated: (posts: MarketingPost[]) => void }) {
  const [request, setRequest] = useState("");
  const [format, setFormat] = useState<"" | "post" | "carousel" | "story">("");
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState<"" | "ai" | "video">("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  async function generate() {
    setBusy("ai");
    setError("");
    try {
      const { posts } = await api<{ posts: MarketingPost[] }>("/api/admin/marketing", "POST", {
        kind: "generate",
        count,
        request,
        ...(format ? { format } : {}),
      });
      setRequest("");
      onCreated(posts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy("");
    }
  }
  async function upload(file: File) {
    if (file.size > 100 * 1024 * 1024) {
      setError("O vídeo passa de 100 MB. Exporte em 1080p com menos tempo.");
      return;
    }
    setBusy("video");
    setError("");
    setProgress("Enviando o vídeo…");
    try {
      const target = await api<{ signedUrl: string; publicUrl: string }>("/api/admin/marketing", "POST", {
        kind: "uploadUrl",
        fileName: file.name,
      });
      const sent = await fetch(target.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "video/mp4", "x-upsert": "false" },
        body: file,
      });
      if (!sent.ok) throw new Error("O envio do vídeo falhou. Tente de novo.");
      const post = await api<MarketingPost>("/api/admin/marketing", "POST", {
        kind: "reel",
        videoUrl: target.publicUrl,
        theme: file.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Reel",
        caption: "",
      });
      onCreated([post]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy("");
      setProgress("");
    }
  }
  return (
    <section className="pf-panel mk-create">
      <div className="pf-panel-head">
        <h2>Criar conteúdo</h2>
      </div>
      <textarea
        rows={2}
        maxLength={500}
        placeholder="Opcional: diga o tema. Ex.: carrossel sobre como reduzir faltas com lembrete e sinal por Pix."
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        disabled={disabled}
      />
      <div className="mk-actions">
        <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} disabled={disabled} aria-label="Formato">
          <option value="">Formatos variados</option>
          <option value="carousel">Carrossel</option>
          <option value="post">Post único</option>
          <option value="story">Story</option>
        </select>
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={disabled} aria-label="Quantidade">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n === 1 ? "1 ideia" : `${n} ideias`}</option>
          ))}
        </select>
        <button type="button" className="mk-primary" disabled={disabled || !!busy} onClick={() => void generate()}>
          <Sparkle size={16} weight="fill" /> {busy === "ai" ? "Criando… (até 1 min)" : "Criar com IA"}
        </button>
        <label className={`mk-upload${busy ? " is-disabled" : ""}`}>
          <VideoCamera size={16} /> {busy === "video" ? progress : "Subir Reel (MP4)"}
          <input
            type="file"
            accept="video/mp4,video/quicktime"
            disabled={!!busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
      </div>
      {error && <em className="mk-error">{error}</em>}
    </section>
  );
}

function PostCard({
  post,
  connected,
  onChange,
}: {
  post: MarketingPost;
  connected: boolean;
  onChange: (post: MarketingPost) => void;
}) {
  const [caption, setCaption] = useState(post.caption);
  const [slides, setSlides] = useState<Slide[]>(post.slides);
  const [at, setAt] = useState(toLocalInput(post.scheduledFor));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slide, setSlide] = useState(0);
  const locked = post.status === "published" || post.status === "publishing";
  const changed = caption !== post.caption || JSON.stringify(slides) !== JSON.stringify(post.slides);
  async function act(body: Record<string, unknown>, method = "PATCH") {
    setBusy(true);
    setError("");
    try {
      const next = await api<MarketingPost>(`/api/admin/marketing/${post.id}`, method, method === "PATCH" ? body : undefined);
      onChange(next);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy(false);
    }
  }
  const edits = changed ? { caption, slides: post.format === "reel" ? undefined : slides } : {};
  const version = Date.parse(post.updatedAt) || 0;
  return (
    <article className={`mk-card is-${post.format}`}>
      <div className="mk-preview">
        {post.format === "reel" ? (
          post.videoUrl ? <video src={post.videoUrl} controls preload="metadata" playsInline /> : <span>Sem vídeo</span>
        ) : (
          <img src={`/api/marketing/image/${post.id}/${slide}.jpg?v=${version}`} alt={post.slides[slide]?.title || post.theme} loading="lazy" />
        )}
        {post.slides.length > 1 && (
          <div className="mk-dots">
            {post.slides.map((_, i) => (
              <button key={i} type="button" aria-label={`Tela ${i + 1}`} className={i === slide ? "is-on" : ""} onClick={() => setSlide(i)} />
            ))}
          </div>
        )}
      </div>
      <div className="mk-body">
        <div className="mk-meta">
          <span className="mk-tag">{formatLabel[post.format]}</span>
          {post.origin === "ia" && <span className="mk-tag is-ai">IA</span>}
          {post.scheduledFor && post.status === "scheduled" && (
            <span className="mk-muted"><CalendarBlank size={13} /> {when(post.scheduledFor)}</span>
          )}
          {post.status === "publishing" && <span className="mk-muted">Publicando…</span>}
          {post.publishedAt && <span className="mk-muted">Publicado {when(post.publishedAt)}</span>}
        </div>
        <strong className="mk-theme">{post.theme}</strong>
        {post.status === "published" && (
          <div className="mk-stats">
            <span><Heart size={14} /> {post.likes ?? "–"}</span>
            <span><ChatCircle size={14} /> {post.comments ?? "–"}</span>
            {post.permalink && (
              <a href={post.permalink} target="_blank" rel="noreferrer">
                Ver no Instagram <ArrowSquareOut size={13} />
              </a>
            )}
          </div>
        )}
        {post.error && <em className="mk-error">{post.error}</em>}
        {editing && !locked ? (
          <div className="mk-edit">
            {post.format !== "reel" &&
              slides.map((s, i) => (
                <fieldset key={i}>
                  <legend>Tela {i + 1}</legend>
                  <input value={s.title} maxLength={120} onChange={(e) => setSlides(slides.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <textarea rows={2} maxLength={280} value={s.body} onChange={(e) => setSlides(slides.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
                </fieldset>
              ))}
            {post.format !== "story" && (
              <label className="mk-block">
                Legenda
                <textarea rows={6} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} />
              </label>
            )}
            <div className="mk-actions">
              <button type="button" className="mk-primary" disabled={busy || !changed} onClick={() => void act({ action: "save", ...edits })}>
                Salvar textos
              </button>
              <button type="button" className="pf-text-button" onClick={() => { setCaption(post.caption); setSlides(post.slides); setEditing(false); }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          post.format !== "story" && <p className="mk-caption">{post.caption || "Sem legenda."}</p>
        )}
        {!locked && !editing && (
          <div className="mk-actions">
            <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Data e hora da publicação" />
            <button type="button" className="mk-primary" disabled={busy || !connected} onClick={() => void act({ action: "schedule", scheduledFor: fromLocalInput(at) })}>
              <CalendarBlank size={15} /> {post.status === "scheduled" ? "Reagendar" : "Aprovar e agendar"}
            </button>
            <button type="button" className="mk-ghost" disabled={busy || !connected} onClick={() => void act({}, "POST")}>
              <PaperPlaneTilt size={15} /> {busy ? "Publicando…" : "Publicar agora"}
            </button>
            <button type="button" className="pf-text-button" onClick={() => setEditing(true)}>Editar</button>
            {post.status === "scheduled" && (
              <button type="button" className="pf-text-button" disabled={busy} onClick={() => void act({ action: "unschedule" })}>Tirar da agenda</button>
            )}
            <button type="button" className="mk-icon" aria-label="Descartar" disabled={busy} onClick={() => void act({ action: "discard" })}>
              <Trash size={16} />
            </button>
          </div>
        )}
        {!connected && !locked && <span className="mk-muted"><UploadSimple size={13} /> Conecte o Instagram para publicar.</span>}
        {error && <em className="mk-error">{error}</em>}
      </div>
    </article>
  );
}
