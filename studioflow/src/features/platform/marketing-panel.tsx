"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  Key,
  Megaphone,
  CalendarBlank,
  FilmSlate,
  Lightbulb,
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
import "./ai-control.css";

interface State {
  account: { username: string } | null;
  settings: MarketingSettings;
  posts: MarketingPost[];
  ai: boolean;
  aiSource: "panel" | "server" | null;
  enabled: boolean;
  model: Model;
  videoAi: boolean;
  videoAiSource: "panel" | "server" | null;
  videoJobs: VideoJob[];
  demo: boolean;
}

type VideoJob = {
  id: string;
  status: "starting" | "processing" | "saving" | "completed" | "failed";
  prompt: string;
  caption: string;
  aspectRatio: "9:16" | "16:9";
  resolution: "720p" | "1080p";
  error: string | null;
  createdAt: string;
  postId: string | null;
};

type Model = "claude-haiku-5-5" | "claude-sonnet-5-5" | "claude-opus-5-5";

// Preço por milhão de tokens (entrada/saída) em dólar: Haiku 0,10/0,50,
// Sonnet 2/10, Opus 4/20. As ideias são curtas, então a diferença é o preço.
const models: [Model, string, string][] = [
  ["claude-haiku-5-5", "Econômico", "Gasta o mínimo. Bom para posts do dia a dia."],
  ["claude-sonnet-5-5", "Equilibrado", "Metade do custo do Máximo, texto mais trabalhado."],
  ["claude-opus-5-5", "Máximo", "O texto mais caprichado, com o maior custo."],
];

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
  const [area, setArea] = useState<"content" | "photo">("content");
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
  const addVideoPost = useCallback((post: MarketingPost) => {
    setState((current) =>
      current && !current.posts.some((item) => item.id === post.id)
        ? { ...current, posts: [post, ...current.posts] }
        : current,
    );
    setTab(post.status === "scheduled" ? "scheduled" : "draft");
    setArea("content");
  }, []);
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
      <Power state={state} onChange={(enabled) => setState({ ...state, enabled })} />
      <div className="mk-top">
        <div className="mk-stack">
          <Account state={state} onChange={load} />
          <AiKey state={state} onChange={load} />
          <VideoKey state={state} onChange={load} />
        </div>
        <Autopilot state={state} onSaved={(settings) => setState({ ...state, settings })} />
      </div>
      <div className="mk-section-tabs" role="tablist" aria-label="Ferramentas de publicação">
        <button type="button" role="tab" aria-selected={area === "content"} className={area === "content" ? "is-current" : ""} onClick={() => setArea("content")}>
          Conteúdo e fila
        </button>
        <button type="button" role="tab" aria-selected={area === "photo"} className={area === "photo" ? "is-current" : ""} onClick={() => setArea("photo")}>
          Postar foto
        </button>
      </div>
      {area === "photo" && <ManualPhoto state={state} onCreated={addVideoPost} />}
      <div hidden={area === "photo"}>
      <VideoStudio state={state} onCreated={addVideoPost} />
      <Suggest
        disabled={!state.ai || state.demo || !state.enabled}
        onCreated={(posts) => {
          setState({ ...state, posts: [...posts, ...state.posts] });
          setTab("draft");
        }}
      />
      <Create
        disabled={!state.ai || state.demo || !state.enabled}
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
              <PostCard
                key={post.id}
                post={post}
                connected={!!state.account}
                canReel={state.enabled && !state.demo}
                onChange={replace}
                onCreated={(reel) => setState((s) => (s ? { ...s, posts: [reel, ...s.posts] } : s))}
              />
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
    </div>
  );
}

/** Chave separada do Google: nunca compartilhada com a IA de texto. */
function VideoKey({ state, onChange }: { state: State; onChange: () => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/marketing", "POST", body);
      setKey("");
      onChange();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível configurar o Google.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pf-panel mk-account">
      <div className="mk-account-head">
        <FilmSlate size={26} />
        <div>
          <strong>Vídeos com IA do Google</strong>
          <span>
            {state.videoAiSource === "panel"
              ? "Chave validada e guardada cifrada no servidor."
              : state.videoAiSource === "server"
                ? "Usando a chave configurada no servidor."
                : "Conecte uma chave do Google AI para gerar vídeos com Veo."}
          </span>
        </div>
      </div>
      {state.videoAiSource === "panel" ? (
        <button
          type="button"
          className="pf-text-button"
          disabled={busy || state.demo}
          onClick={() => void run({ kind: "videoAiKeyRemove" })}
        >
          Remover chave
        </button>
      ) : state.videoAiSource === "server" ? null : (
        <form
          className="mk-inline"
          onSubmit={(event) => {
            event.preventDefault();
            void run({ kind: "videoAiKey", key });
          }}
        >
          <input
            type="password"
            autoComplete="off"
            placeholder="Chave do Google AI"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            aria-label="Chave de vídeo do Google AI"
          />
          <button
            type="submit"
            className="mk-primary"
            disabled={busy || key.trim().length < 20 || state.demo}
          >
            {busy ? "Validando…" : "Conectar"}
          </button>
        </form>
      )}
      {error && <em className="mk-error">{error}</em>}
    </section>
  );
}

/** Gera um clipe Veo; o resultado sempre entra na fila como rascunho. */
function VideoStudio({
  state,
  onCreated,
}: {
  state: State;
  onCreated: (post: MarketingPost) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [caption, setCaption] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [job, setJob] = useState<VideoJob | null>(
    () =>
      state.videoJobs.find((item) =>
        ["starting", "processing", "saving"].includes(item.status),
      ) ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const jobId = job?.id;
  const jobStatus = job?.status;
  useEffect(() => {
    if (
      !jobId ||
      !jobStatus ||
      !["starting", "processing", "saving"].includes(jobStatus)
    )
      return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await api<{ job: VideoJob; post: MarketingPost | null }>(
          "/api/admin/marketing",
          "POST",
          { kind: "checkVideo", id: jobId },
        );
        if (cancelled) return;
        setJob(result.job);
        setError("");
        if (result.post && result.job.status === "completed")
          onCreated(result.post);
        else if (
          ["starting", "processing", "saving"].includes(result.job.status)
        )
          timer = setTimeout(poll, 10_000);
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível consultar a geração.",
        );
        timer = setTimeout(poll, 15_000);
      }
    };
    timer = setTimeout(poll, 5_000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, jobStatus, onCreated]);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = await api<VideoJob>("/api/admin/marketing", "POST", {
        kind: "generateVideo",
        prompt,
        caption,
        aspectRatio,
        resolution,
      });
      setPrompt("");
      setCaption("");
      setJob(next);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível iniciar o vídeo.",
      );
    } finally {
      setBusy(false);
    }
  }
  const generating =
    !!job && ["starting", "processing", "saving"].includes(job.status);
  return (
    <section className="pf-panel mk-video-studio">
      <div className="pf-panel-head mk-video-head">
        <div>
          <span className="mk-video-kicker">
            <Sparkle size={14} weight="fill" /> ESTÚDIO CRIATIVO
          </span>
          <h2>Vídeos profissionais com IA</h2>
          <p>
            Descreva a cena. O Google gera o clipe; o StudioFlow salva o Reel
            nos rascunhos para você revisar e publicar.
          </p>
        </div>
        <span className="mk-video-mark">
          <FilmSlate size={22} />
        </span>
      </div>
      {state.videoAi ? (
        <form
          className="mk-video-form"
          onSubmit={(event) => void generate(event)}
        >
          <label className="mk-video-prompt">
            Descreva o vídeo
            <textarea
              rows={4}
              minLength={20}
              maxLength={2000}
              required
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ex.: Reel vertical para a StudioFlow, mostrando um barbeiro preparando a cadeira, um corte em andamento e o dono conferindo a agenda no celular. Luz cinematográfica, visual grafite com detalhes bronze, movimentos suaves, sem textos gerados."
              disabled={generating || !state.enabled || state.demo}
            />
          </label>
          <label className="mk-video-caption">
            Legenda para acompanhar (opcional)
            <textarea
              rows={2}
              maxLength={2200}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Escreva a legenda que vai junto com o Reel."
              disabled={generating || !state.enabled || state.demo}
            />
          </label>
          <div className="mk-video-controls">
            <label>
              Formato
              <select
                value={aspectRatio}
                onChange={(event) =>
                  setAspectRatio(event.target.value as typeof aspectRatio)
                }
                disabled={generating}
              >
                <option value="9:16">Vertical · Reels/Stories</option>
                <option value="16:9">Horizontal</option>
              </select>
            </label>
            <label>
              Resolução
              <select
                value={resolution}
                onChange={(event) =>
                  setResolution(event.target.value as typeof resolution)
                }
                disabled={generating}
              >
                <option value="720p">720p · padrão</option>
                <option value="1080p">1080p · alta</option>
              </select>
            </label>
            <button
              className="mk-primary"
              type="submit"
              disabled={
                busy ||
                generating ||
                !state.enabled ||
                state.demo ||
                prompt.trim().length < 20
              }
            >
              <Sparkle size={16} weight="fill" />{" "}
              {busy ? "Iniciando…" : "Gerar vídeo · 8 s"}
            </button>
          </div>
          <p className="mk-video-cost">
            Cada geração consome créditos da conta Google. O vídeo entra como
            rascunho; nada é publicado sem sua aprovação.
          </p>
        </form>
      ) : (
        <div className="mk-video-connect">
          <strong>Conecte a chave do Google para liberar o estúdio.</strong>
          <span>
            A chave fica protegida no servidor e separada da IA que escreve as
            legendas.
          </span>
        </div>
      )}
      {generating && (
        <div className="mk-video-progress" role="status" aria-live="polite">
          <span className="mk-video-pulse" />
          <div>
            <strong>
              {job.status === "saving"
                ? "Salvando seu Reel…"
                : job.status === "starting"
                  ? "Preparando o vídeo…"
                  : "O Google está criando seu vídeo…"}
            </strong>
            <small>
              Isso pode levar alguns minutos. Você pode continuar usando o
              painel.
            </small>
          </div>
        </div>
      )}
      {job?.status === "completed" && (
        <p className="mk-video-success" role="status">
          Vídeo pronto. O Reel foi adicionado aos rascunhos para revisão.
        </p>
      )}
      {job?.status === "failed" && (
        <p className="mk-error" role="alert">
          {job.error ||
            "A geração não foi concluída. Confira a chave e a cota do Google antes de tentar novamente."}
        </p>
      )}
      {error && (
        <p className="mk-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** Chave geral do Marketing: desligado, nada é criado nem publicado. */
function Power({ state, onChange }: { state: State; onChange: (enabled: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const on = state.enabled;
  const ready = !!state.account && state.ai;
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const next = await api<{ enabled: boolean }>("/api/admin/marketing", "POST", {
        kind: "power",
        enabled: !on,
      });
      onChange(next.enabled);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`pf-ai ${on ? "is-on" : "is-off"}`} aria-labelledby="mk-power-title">
      <span className="pf-ai-icon" aria-hidden="true">
        <Megaphone size={24} weight="duotone" />
      </span>
      <div className="pf-ai-text">
        <div className="pf-ai-head">
          <h2 id="mk-power-title">Marketing automático</h2>
          <span className="pf-ai-badge" role="status">
            <i aria-hidden="true" />
            {on ? (ready ? "Ligado" : "Ligado, falta configurar") : "Desligado"}
          </span>
        </div>
        <p>
          {on
            ? "A IA cria os posts e o servidor publica nos horários marcados."
            : "Nada é criado nem publicado. A fila e as configurações ficam guardadas para quando você ligar."}{" "}
          {on && !ready && (
            <span>
              Falta {!state.account && !state.ai ? "conectar o Instagram e salvar a chave da IA" : !state.account ? "conectar o Instagram" : "salvar a chave da IA"}.
            </span>
          )}
        </p>
        {error && (
          <p className="pf-ai-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="mk-power-title"
        className="pf-ai-switch"
        onClick={() => void toggle()}
        disabled={busy || state.demo}
      >
        <span className="pf-ai-track">
          <span className="pf-ai-thumb" />
        </span>
        <span className="pf-ai-label">{busy ? "Salvando…" : on ? "Desligar" : "Ligar"}</span>
      </button>
    </section>
  );
}

/** Chave da Anthropic só do Marketing, guardada cifrada; nunca volta para a tela. */
function AiKey({ state, onChange }: { state: State; onChange: () => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/marketing", "POST", body);
      setKey("");
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
        <Key size={26} />
        <div>
          <strong>Chave da IA</strong>
          <span>
            {state.aiSource === "panel"
              ? "Chave da Anthropic salva e cifrada. Ela só é usada para criar os posts da StudioFlow."
              : state.aiSource === "server"
                ? "Usando a chave configurada no servidor. Se preferir, salve outra aqui."
                : "Cole uma chave da Anthropic (console.anthropic.com → API Keys). Ela fica cifrada e só cria os posts da StudioFlow."}
          </span>
        </div>
      </div>
      {state.aiSource === "panel" ? (
        <button type="button" className="pf-text-button" disabled={busy} onClick={() => void run({ kind: "aiKeyRemove" })}>
          Remover chave
        </button>
      ) : (
        <form
          className="mk-inline"
          onSubmit={(event) => {
            event.preventDefault();
            void run({ kind: "aiKey", key });
          }}
        >
          <input
            type="password"
            autoComplete="off"
            placeholder="sk-ant-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            aria-label="Chave da Anthropic"
          />
          <button type="submit" className="mk-primary" disabled={busy || key.trim().length < 20 || state.demo}>
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </form>
      )}
      {state.ai && (
        <fieldset className="mk-models">
          <legend>Quem escreve os posts</legend>
          {models.map(([id, label, hint]) => (
            <label key={id} className={state.model === id ? "is-on" : ""}>
              <input
                type="radio"
                name="mk-model"
                value={id}
                checked={state.model === id}
                disabled={busy || state.demo}
                onChange={() => void run({ kind: "model", model: id })}
              />
              <b>{label}</b>
              <small>{hint}</small>
            </label>
          ))}
        </fieldset>
      )}
      {error && <em className="mk-error">{error}</em>}
    </section>
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
  const [reading, setReading] = useState(false);
  const [reason, setReason] = useState("");
  const canRead = state.ai && state.enabled && !state.demo;
  async function analyze() {
    setReading(true);
    setMessage("");
    setReason("");
    try {
      const out = await api<{ voice: string; reason: string }>("/api/admin/marketing", "POST", {
        kind: "suggestVoice",
        current: form.voice,
      });
      setForm((f) => ({ ...f, voice: out.voice }));
      setReason(out.reason);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível analisar.");
    } finally {
      setReading(false);
    }
  }
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
          checked={form.weeklyReel}
          disabled={!form.autopilot}
          onChange={(e) => setForm({ ...form, weeklyReel: e.target.checked })}
        />
        <span>
          <b>Um Reel por semana</b>
          <small>Transforma um carrossel da semana em vídeo com movimento. Não gasta IA.</small>
        </span>
      </label>
      <label className="mk-check">
        <input
          type="checkbox"
          checked={form.autoPublish}
          onChange={(e) => setForm({ ...form, autoPublish: e.target.checked })}
        />
        <span>
          <b>Publicar sem minha aprovação</b>
          <small>
            {form.autoPublish
              ? "Ligado: as fotos enviadas e os conteúdos com publicação automática saem nos dias e horários escolhidos."
              : "Desligado: fotos enviadas ficam em rascunhos; conteúdos podem ser aprovados e agendados individualmente."}
          </small>
        </span>
      </label>
      <div className="mk-row">
        <fieldset className="mk-days">
          <legend>Dias de publicação</legend>
          <div>
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label, day) => (
              <label key={day} className={form.postDays.includes(day) ? "is-selected" : ""}>
                <input
                  type="checkbox"
                  checked={form.postDays.includes(day)}
                  onChange={(event) => {
                    const postDays = event.target.checked
                      ? [...form.postDays, day].sort((a, b) => a - b)
                      : form.postDays.filter((item) => item !== day);
                    if (postDays.length) setForm({ ...form, postDays, postsPerWeek: postDays.length });
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          <small>{form.postDays.length} {form.postDays.length === 1 ? "dia escolhido" : "dias escolhidos"} por semana.</small>
        </fieldset>
        <label>
          Horário (Brasília)
          <select value={form.postHour} onChange={(e) => setForm({ ...form, postHour: Number(e.target.value) })}>
            {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
              <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mk-block">
        <span className="mk-label-row">
          Orientação para a IA
          <button type="button" className="mk-mini" disabled={!canRead || reading} onClick={() => void analyze()}>
            <Lightbulb size={14} /> {reading ? "Analisando…" : "Analisar com IA"}
          </button>
        </span>
        <textarea
          rows={form.voice.length > 120 ? 6 : 2}
          maxLength={1000}
          aria-label="Orientação para a IA"
          placeholder="Ex.: falar mais da recepcionista no WhatsApp; tom descontraído; nada de gírias."
          value={form.voice}
          onChange={(e) => setForm({ ...form, voice: e.target.value })}
        />
        {reason && <small className="mk-reason">Sugestão da IA, baseada em: {reason} Revise e clique em Salvar.</small>}
      </div>
      <div className="mk-actions">
        <button type="button" className="mk-primary" disabled={!dirty || busy || state.demo} onClick={() => void save()}>
          {busy ? "Salvando…" : "Salvar"}
        </button>
        {message && <span className="mk-muted">{message}</span>}
      </div>
    </section>
  );
}

function ManualPhoto({ state, onCreated }: { state: State; onCreated: (post: MarketingPost) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseFile(selected: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(selected ? URL.createObjectURL(selected) : "");
    setFile(selected);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("Enviando foto…");
    try {
      const target = await api<{ path: string; signedUrl: string }>("/api/admin/marketing", "POST", {
        kind: "photoUploadUrl",
        contentType: file.type,
      });
      const sent = await fetch(target.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!sent.ok) throw new Error("O envio da foto falhou. Tente novamente.");
      const post = await api<MarketingPost>("/api/admin/marketing", "POST", {
        kind: "manualPhoto",
        path: target.path,
        caption,
        theme: theme || file.name.replace(/\.[^.]+$/, "").slice(0, 200),
      });
      onCreated(post);
      chooseFile(null);
      setCaption("");
      setTheme("");
      setMessage(post.scheduledFor ? `Agendado para ${when(post.scheduledFor)}.` : "Foto salva em rascunhos para aprovação.");
    } catch (cause) {
      setMessage("");
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a foto.");
    } finally {
      setBusy(false);
    }
  }
  const disabled = !state.enabled || state.demo || !state.account;
  return (
    <section className="pf-panel mk-manual-photo">
      <div className="pf-panel-head">
        <div>
          <span className="mk-video-kicker">PUBLICAÇÃO DIRETA</span>
          <h2>Postar uma foto</h2>
        <p>Envie uma foto do corte e escreva a legenda. Com a publicação automática ligada, ela entra no próximo dia e horário selecionados.</p>
        </div>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <label className="mk-photo-picker">
          {file && preview ? <img src={preview} alt="Prévia da foto escolhida" /> : <UploadSimple size={23} />}
          <span>{file ? file.name : "Escolher foto JPG ou PNG"}</span>
          <small>Até 20 MB</small>
          <input
            type="file"
            accept="image/jpeg,image/png"
            disabled={disabled || busy}
            onChange={(event) => {
              const selected = event.target.files?.[0] || null;
              event.target.value = "";
              if (selected && selected.size > 20 * 1024 * 1024) {
                setError("A foto precisa ter até 20 MB.");
                return;
              }
              chooseFile(selected);
              setError("");
            }}
          />
        </label>
        <label className="mk-block">
          Nome interno (opcional)
          <input value={theme} maxLength={200} onChange={(event) => setTheme(event.target.value)} placeholder="Ex.: Corte degradê desta semana" disabled={disabled || busy} />
        </label>
        <label className="mk-block">
          Legenda do Instagram
          <textarea rows={4} maxLength={2200} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Escreva uma legenda para acompanhar a foto…" disabled={disabled || busy} />
        </label>
        {!state.settings.autoPublish ? (
          <p className="mk-photo-note">A foto vai para rascunhos. Para agendar automaticamente, ligue “Publicar sem minha aprovação” no Piloto automático.</p>
        ) : (
          <p className="mk-photo-note">Próximo horário: {state.settings.postDays.map((day) => ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][day]).join(", ")} às {String(state.settings.postHour).padStart(2, "0")}:00 · horário de Brasília.</p>
        )}
        <div className="mk-actions">
          <button className="mk-primary" type="submit" disabled={disabled || busy || !file}>{busy ? "Enviando…" : "Adicionar à fila"}</button>
          {!state.account && <span className="mk-muted">Conecte o Instagram para adicionar fotos à fila.</span>}
          {message && <span className="mk-muted" role="status">{message}</span>}
          {error && <em className="mk-error">{error}</em>}
        </div>
      </form>
    </section>
  );
}

type Suggestion = { title: string; format: "post" | "carousel" | "story"; why: string; brief: string };

/** A IA analisa o que já saiu e o que você colar, e sugere pautas. */
function Suggest({ disabled, onCreated }: { disabled: boolean; onCreated: (posts: MarketingPost[]) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<number | "read" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ reading: string; suggestions: Suggestion[] } | null>(null);
  const [made, setMade] = useState<number[]>([]);
  async function analyze() {
    setBusy("read");
    setError("");
    try {
      setResult(await api("/api/admin/marketing", "POST", { kind: "suggest", note }));
      setMade([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível analisar.");
    } finally {
      setBusy(null);
    }
  }
  async function create(index: number, item: Suggestion) {
    setBusy(index);
    setError("");
    try {
      const { posts } = await api<{ posts: MarketingPost[] }>("/api/admin/marketing", "POST", {
        kind: "generate",
        count: 1,
        format: item.format,
        request: `${item.title}. ${item.brief}`.slice(0, 500),
      });
      setMade((m) => [...m, index]);
      onCreated(posts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="pf-panel mk-suggest">
      <div className="pf-panel-head">
        <h2><Lightbulb size={18} /> Sugestões da IA</h2>
      </div>
      <p className="mk-muted">
        A IA lê os posts que já saíram, com curtidas e comentários, e o que você colar abaixo. Depois sugere o que postar e por quê.
      </p>
      <textarea
        rows={3}
        maxLength={3000}
        placeholder="Opcional: cole uma dúvida que cliente sempre faz, um post que você viu e gostou, uma novidade do sistema, uma data especial…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={disabled}
        aria-label="Material para a IA analisar"
      />
      <div className="mk-actions">
        <button type="button" className="mk-primary" disabled={disabled || busy !== null} onClick={() => void analyze()}>
          <Lightbulb size={16} /> {busy === "read" ? "Analisando…" : result ? "Analisar de novo" : "Analisar e sugerir"}
        </button>
      </div>
      {error && <em className="mk-error">{error}</em>}
      {result && (
        <div className="mk-suggest-out">
          {result.reading && <p className="mk-reading">{result.reading}</p>}
          <ol className="mk-ideas">
            {result.suggestions.map((item, i) => (
              <li key={i}>
                <div>
                  <span className="mk-tag">{formatLabel[item.format]}</span>
                  <b>{item.title}</b>
                  <small>{item.why}</small>
                </div>
                <button
                  type="button"
                  className="mk-ghost"
                  disabled={disabled || busy !== null || made.includes(i)}
                  onClick={() => void create(i, item)}
                >
                  {made.includes(i) ? "Criado" : busy === i ? "Criando…" : "Criar este"}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
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
  canReel,
  onChange,
  onCreated,
}: {
  post: MarketingPost;
  connected: boolean;
  canReel: boolean;
  onChange: (post: MarketingPost) => void;
  onCreated: (post: MarketingPost) => void;
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
  const [reeling, setReeling] = useState(false);
  async function toReel() {
    setReeling(true);
    setError("");
    try {
      onCreated(await api<MarketingPost>("/api/admin/marketing", "POST", { kind: "toReel", id: post.id }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível montar o vídeo.");
    } finally {
      setReeling(false);
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
          <img src={post.slides[slide]?.imageUrl || `/api/marketing/image/${post.id}/${slide}.jpg?v=${version}`} alt={post.slides[slide]?.title || post.theme} loading="lazy" />
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
        {post.format !== "reel" && post.slides.length > 0 && !editing && (
          <button type="button" className="mk-ghost mk-reel" disabled={reeling || !canReel} onClick={() => void toReel()}>
            <FilmSlate size={15} /> {reeling ? "Montando o vídeo…" : "Virar Reel"}
          </button>
        )}
        {reeling && <span className="mk-muted">Leva uns 20 segundos. Sem gastar IA: usa as telas deste post.</span>}
        {!connected && !locked && <span className="mk-muted"><UploadSimple size={13} /> Conecte o Instagram para publicar.</span>}
        {error && <em className="mk-error">{error}</em>}
      </div>
    </article>
  );
}
