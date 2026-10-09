"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  Fragment,
} from "react";
import {
  ArrowLeft,
  ArrowUp,
  ChatCircleText,
  MagnifyingGlass,
  ArrowClockwise,
  UserCircle,
  Warning,
  DotsThree,
  Info,
  CalendarDots,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { InstagramIcon, WhatsAppIcon } from "@/components/brand-icons";
import { Avatar, Button, EmptyState, PageHeader } from "@/components/ui";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import {
  customerContext,
  channelMessages,
  inboxLabel,
  inboxQueue,
  needsAttention,
  waitingLabel,
} from "@/lib/inbox";
import { formatPhone } from "@/lib/utils";
import type {
  ConversationMessage,
  ConversationStatus,
  ConversationSummary,
  Store,
} from "@/types";
import { ManagementBoundary } from "./shared";
import "./conversations.css";
import "./messages.css";
import { ModuleGate } from "@/features/dashboard/module-lock";
import { WhatsAppContacts } from "./whatsapp-contacts";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível.");
  return data as T;
}

const statusText: Record<ConversationStatus, string> = {
  ai: "Com StudioFlow",
  human: "Com a equipe",
  closed: "Concluída",
};
const time = (iso: string) => {
  const date = new Date(iso);
  const today = dayKey(new Date()) === dayKey(date);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    ...(today
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit" }),
  }).format(date);
};
const dayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const dayLabel = (iso: string) =>
  dayKey(new Date(iso)) === dayKey(new Date())
    ? "Hoje"
    : new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(iso));
const messageTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
const who = (
  item: Pick<ConversationSummary, "contactName" | "contactPhone" | "channel">,
) =>
  item.contactName ||
  (item.contactPhone
    ? formatPhone(item.contactPhone)
    : item.channel === "web"
      ? "Visitante do site"
      : item.channel === "instagram"
        ? "Cliente do Instagram"
        : "Cliente");

const channelName = (item: ConversationSummary, store: Store) =>
  item.channel === "whatsapp"
    ? `WhatsApp · ${
        item.whatsappProfessionalId
          ? store.professionals.find(
              (p) => p.id === item.whatsappProfessionalId,
            )?.name || "Profissional"
          : "Loja"
      }`
    : item.channel === "instagram"
      ? "Instagram Direct"
      : "Chat do site";

export default function ConversationsPage() {
  const { data } = useWorkspace();
  return (
    <ManagementBoundary>
      <ModuleGate module="recepcionista">
        {data && <ConversationsContent store={data} />}
      </ModuleGate>
    </ManagementBoundary>
  );
}

function ConversationsContent({ store }: { store: Store }) {
  const { role } = usePermissions();
  const canAnswer = [
    "owner",
    "admin",
    "manager",
    "receptionist",
    "professional",
  ].includes(role || "");
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [active, setActive] = useState<string>("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "unread" | "attention" | "outside" | ConversationStatus
  >("all");
  const [channel, setChannel] = useState(
    store.viewer?.professionalId
      ? `professional:${store.viewer.professionalId}`
      : "whatsapp",
  );
  const [inboxTab, setInboxTab] = useState<"conversations" | "contacts">(
    "conversations",
  );
  const page = useRef<HTMLDivElement>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const hasThread = !!list?.some((item) => item.id === active);

  useEffect(() => {
    if (!hasThread) return;
    const element = page.current;
    const viewport = window.visualViewport;
    const mobile = window.matchMedia("(max-width: 860px)");
    const previousOverflow = document.body.style.overflow;
    const resize = () => {
      document.body.style.overflow = mobile.matches
        ? "hidden"
        : previousOverflow;
      if (mobile.matches && viewport && viewport.scale === 1) {
        element?.style.setProperty(
          "--chat-viewport-height",
          `${viewport.height}px`,
        );
        element?.style.setProperty(
          "--chat-viewport-top",
          `${viewport.offsetTop}px`,
        );
      } else {
        element?.style.removeProperty("--chat-viewport-height");
        element?.style.removeProperty("--chat-viewport-top");
      }
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    mobile.addEventListener("change", resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      element?.style.removeProperty("--chat-viewport-height");
      element?.style.removeProperty("--chat-viewport-top");
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      mobile.removeEventListener("change", resize);
    };
  }, [active, hasThread]);

  const refresh = useCallback(async () => {
    try {
      setList(
        await request<ConversationSummary[]>("/api/workspace/conversations"),
      );
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível carregar.",
      );
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load of an external inbox
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const settings = store.settings;
  const current = list?.find((item) => item.id === active);
  const inChannel = (item: ConversationSummary) =>
    channel === "all" ||
    (channel === "shop"
      ? item.channel === "whatsapp" && !item.whatsappProfessionalId
      : channel.startsWith("professional:")
        ? item.channel === "whatsapp" &&
          item.whatsappProfessionalId === channel.slice(13)
        : item.channel === channel);
  const inStatus = (item: ConversationSummary, value: typeof filter) =>
    value === "all" ||
    (value === "unread" ? item.unread > 0 : inboxQueue(item) === value);
  const count = (value: typeof filter) =>
    (list || []).filter((item) => inChannel(item) && inStatus(item, value))
      .length;
  const matches = (list || []).filter((item) => {
    const search = query.trim().toLocaleLowerCase("pt-BR");
    const searchMatches =
      !search ||
      `${who(item)} ${item.contactPhone} ${formatPhone(item.contactPhone)} ${item.preview || ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(search);
    const statusMatches = inStatus(item, filter);
    const channelMatches = inChannel(item);
    return searchMatches && statusMatches && channelMatches;
  });
  return (
    <div ref={page} className={`chat-page ${current ? "has-thread" : ""}`}>
      <PageHeader
        title="Conversas"
        description="Mensagens e atendimento, em um só lugar."
        actions={
          <Link
            className="chat-manage-link"
            href="/dashboard/configuracoes?aba=whatsapp"
          >
            Gerenciar canais
          </Link>
        }
      />
      {!settings.assistantEnabled && (
        <div className="chat-notice">
          <Warning size={18} />
          <span>
            O atendimento automático está desligado. Ligue em{" "}
            <Link href="/dashboard/configuracoes">
              Configurações → StudioFlow
            </Link>
            .
          </span>
        </div>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="chat-layout">
        <aside className="chat-list" aria-label="Conversas">
          <div className="chat-list-tools">
            <div className="chat-list-title">
              <strong>Caixa de entrada</strong>
              <button
                type="button"
                onClick={() => void refresh()}
                aria-label="Atualizar conversas"
              >
                <ArrowClockwise size={18} />
              </button>
            </div>
            <label className="chat-search">
              <MagnifyingGlass size={18} />
              <input
                type="search"
                aria-label="Buscar conversa"
                placeholder="Nome, telefone ou mensagem"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select
              aria-label="Filtrar canal de atendimento"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              {role !== "professional" && (
                <>
                  <option value="all">Todos os canais</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="shop">WhatsApp da loja</option>
                </>
              )}
              {store.professionals.map((person) => (
                <option key={person.id} value={`professional:${person.id}`}>
                  WhatsApp · {person.name}
                </option>
              ))}
              {role !== "professional" && (
                <option value="web">Página pública</option>
              )}
              {list?.some((item) => item.channel === "instagram") && (
                <option value="instagram">Instagram</option>
              )}
            </select>
            <div
              className="chat-inbox-tabs"
              role="group"
              aria-label="Conteúdo da caixa de entrada"
            >
              <button
                type="button"
                aria-pressed={inboxTab === "conversations"}
                onClick={() => setInboxTab("conversations")}
              >
                Conversas
              </button>
              <button
                type="button"
                aria-pressed={inboxTab === "contacts"}
                onClick={() => {
                  setInboxTab("contacts");
                  if (channel === "all") {
                    const own = store.professionalWhatsAppLinks?.find(
                      (l) => l.status === "open",
                    );
                    setChannel(
                      own ? `professional:${own.professionalId}` : "shop",
                    );
                  }
                }}
              >
                Contatos
              </button>
            </div>
            {inboxTab === "conversations" && (
              <label className="chat-queue-select">
                <span>Situação</span>
                <select
                  aria-label="Filtrar situação"
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as typeof filter)
                  }
                >
                  {(
                    [
                      ["all", "Todas"],
                      ["attention", "Precisa de atenção"],
                      ["unread", "Não lidas"],
                      ["human", "Com a equipe"],
                      ["ai", "Com StudioFlow"],
                      ["closed", "Concluídas"],
                      ["outside", "Fora do atendimento"],
                    ] as const
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label} · {count(value)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="chat-inbox-items">
            {inboxTab === "contacts" ? (
              <WhatsAppContacts
                key={channel}
                channel={channel}
                search={query}
                onOpen={async (id) => {
                  await refresh();
                  setActive(id);
                  setInboxTab("conversations");
                }}
              />
            ) : list === null ? (
              <p className="chat-muted">Carregando…</p>
            ) : list.length === 0 ? (
              <EmptyState
                title="Nenhuma conversa ainda"
                description="Os atendimentos de clientes pelo WhatsApp ou pela página pública aparecem aqui."
              />
            ) : matches.length === 0 ? (
              <div className="chat-filter-empty">
                <ChatCircleText size={28} />
                <strong>Nenhuma conversa encontrada</strong>
                <p>Experimente outro nome ou filtro.</p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                    setChannel(
                      store.viewer?.professionalId
                        ? `professional:${store.viewer.professionalId}`
                        : "all",
                    );
                  }}
                >
                  Limpar filtros
                </Button>
              </div>
            ) : (
              matches.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`chat-item ${item.id === active ? "is-active" : ""} ${item.unread ? "is-unread" : ""}`}
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  onClick={() => setActive(item.id)}
                  aria-pressed={item.id === active}
                >
                  <Avatar name={who(item)} size={40} />
                  <span className="chat-item-main">
                    <strong>
                      {who(item)}
                      {item.channel === "whatsapp" ? (
                        <WhatsAppIcon size={13} />
                      ) : item.channel === "instagram" ? (
                        <InstagramIcon size={13} />
                      ) : (
                        <ChatCircleText size={13} weight="duotone" />
                      )}
                    </strong>
                    <small className="chat-channel">
                      {channelName(item, store)}
                    </small>
                    <small
                      className={`chat-item-status is-${needsAttention(item) ? "attention" : item.status}`}
                    >
                      {inboxLabel(item)}
                    </small>
                    <span>
                      {item.latestRole === "assistant"
                        ? "StudioFlow: "
                        : item.latestRole === "staff"
                          ? "Equipe: "
                          : ""}
                      {item.preview || "Histórico disponível"}
                    </span>
                    {needsAttention(item) && (
                      <small className="chat-waiting">
                        {waitingLabel(item)}
                      </small>
                    )}
                  </span>
                  <span className="chat-item-side">
                    <small>
                      {time(item.latestMessageAt || item.lastMessageAt)}
                    </small>
                    {item.unread > 0 ? (
                      <b>{item.unread}</b>
                    ) : (
                      <i
                        className={`chat-dot is-${item.status}`}
                        title={statusText[item.status]}
                      />
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
        <section className="chat-thread" aria-label="Conversa">
          {current ? (
            <Thread
              key={current.id}
              summary={current}
              store={store}
              channelLabel={channelName(current, store)}
              canAnswer={canAnswer}
              draft={drafts[current.id] || ""}
              onDraftChange={(value) =>
                setDrafts((previous) => ({ ...previous, [current.id]: value }))
              }
              onBack={() => setActive("")}
              onChange={refresh}
            />
          ) : (
            <div className="chat-empty">
              <ChatCircleText size={34} weight="duotone" />
              <strong>Seu atendimento, em um só lugar.</strong>
              <p>
                Abra uma conversa para acompanhar o histórico e responder ao
                cliente.
              </p>
              <span className="chat-empty-note">
                Ao assumir, o StudioFlow pausa nessa conversa.
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Thread({
  summary,
  store,
  channelLabel,
  canAnswer,
  draft,
  onDraftChange,
  onBack,
  onChange,
}: {
  summary: ConversationSummary;
  store: Store;
  channelLabel: string;
  canAnswer: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onBack: () => void;
  onChange: () => Promise<void>;
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [status, setStatus] = useState(summary.status);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const context = customerContext(store, summary);
  const composer = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  useLayoutEffect(() => {
    const textarea = composer.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const borderHeight = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = `${Math.min(140, textarea.scrollHeight + borderHeight)}px`;
  }, [draft]);
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (nearBottom.current) element.scrollTo({ top: element.scrollHeight });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [syncUnavailable, setSyncUnavailable] = useState(false);
  const [analysisReason, setAnalysisReason] = useState<string | null>(
    "Carregando o pedido pendente…",
  );
  const [notice, setNotice] = useState("");
  const [run, setRun] = useState<{
    state: string;
    error_code?: string;
    attempts: number;
    retry_at?: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await request<{
        conversation: ConversationSummary;
        messages: ConversationMessage[];
        syncUnavailable?: boolean;
        analysis?: { reason: string | null };
        run?: {
          state: string;
          error_code?: string;
          attempts: number;
          retry_at?: string;
        } | null;
      }>(`/api/workspace/conversations/${summary.id}`);
      setMessages(data.messages);
      setSyncUnavailable(!!data.syncUnavailable);
      setStatus(data.conversation.status);
      setRun(data.run || null);
      setAnalysisReason(data.analysis?.reason ?? null);
      if (data.run && ["SENT", "SILENT", "FAILED"].includes(data.run.state))
        setNotice("");
      setLoadError("");
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar a conversa.",
      );
    } finally {
      setLoading(false);
    }
  }, [summary.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the thread from the server
    void load().catch(() => undefined);
    const timer = window.setInterval(
      () => void load().catch(() => undefined),
      6000,
    );
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (nearBottom.current)
      list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);

  async function act(body: object) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request<{ notice?: string }>(
        `/api/workspace/conversations/${summary.id}`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      setNotice(result.notice || "");
      await load();
      await onChange();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const visibleMessages = channelMessages(messages);
  const activity = messages.filter((message) => message.role === "event");

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    if (await act({ action: "reply", body: draft })) onDraftChange("");
  }

  return (
    <>
      <header className="chat-thread-head">
        <button
          type="button"
          className="chat-back"
          onClick={onBack}
          aria-label="Voltar para a lista"
        >
          <ArrowLeft size={18} />
        </button>
        <Avatar name={who(summary)} size={40} />
        <div>
          <strong>{who(summary)}</strong>
          <small>
            {channelLabel}
            {summary.contactPhone && (
              <span className="chat-contact-phone">
                {" "}
                · {formatPhone(summary.contactPhone)}
              </span>
            )}
          </small>
          <span className="chat-mobile-status">{statusText[status]}</span>
        </div>
        <span className={`chat-status is-${status}`}>{statusText[status]}</span>
        <button
          type="button"
          className="chat-context-toggle"
          aria-label="Dados do cliente"
          aria-expanded={contextOpen}
          aria-controls={`chat-context-${summary.id}`}
          onClick={() => setContextOpen((open) => !open)}
        >
          <Info size={22} />
        </button>
        <button
          type="button"
          className="chat-controls-toggle"
          aria-label="Opções da conversa"
          aria-expanded={controlsOpen}
          aria-controls={`chat-controls-${summary.id}`}
          onClick={() => setControlsOpen((open) => !open)}
        >
          <span>Atendimento</span>
          <DotsThree size={24} weight="bold" />
        </button>
      </header>
      {contextOpen && (
        <div
          id={`chat-context-${summary.id}`}
          className="chat-customer-context"
        >
          <div>
            <span>Cliente</span>
            <strong>{context.customer?.name || who(summary)}</strong>
            <small>
              {summary.contactPhone
                ? formatPhone(summary.contactPhone)
                : "Telefone não informado"}
            </small>
          </div>
          <div>
            <span>
              <CalendarDots size={14} /> Próximo agendamento
            </span>
            {context.next ? (
              <>
                <strong>
                  {dayLabel(context.next.start)} ·{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(context.next.start))}
                </strong>
                <small>
                  {
                    store.professionals.find(
                      (p) => p.id === context.next?.professionalId,
                    )?.name
                  }{" "}
                  ·{" "}
                  {context.next.serviceIds
                    .map((id) => store.services.find((s) => s.id === id)?.name)
                    .filter(Boolean)
                    .join(", ")}{" "}
                  ·{" "}
                  {context.next.status === "confirmed"
                    ? "Confirmado"
                    : "Pendente"}
                </small>
              </>
            ) : (
              <strong>Nenhum horário futuro neste canal</strong>
            )}
          </div>
          <div>
            <span>
              <CheckCircle size={14} /> Último atendimento
            </span>
            <strong>
              {context.previous
                ? dayLabel(context.previous.start)
                : "Sem atendimento concluído neste canal"}
            </strong>
            <small>Dados da agenda disponível para seu acesso</small>
          </div>
          <Link href="/dashboard/agenda">Abrir agenda</Link>
        </div>
      )}
      <div
        id={`chat-controls-${summary.id}`}
        className={`chat-thread-controls ${controlsOpen ? "is-open" : ""}`}
      >
        {summary.contactPhone && (
          <div className="chat-mobile-contact">
            {channelLabel} · {formatPhone(summary.contactPhone)}
          </div>
        )}
        {canAnswer && (
          <div className="chat-actions">
            {status !== "human" && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void act({ action: "status", status: "human" })}
              >
                <UserCircle size={16} /> Assumir
              </Button>
            )}
            {status !== "ai" && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void act({ action: "status", status: "ai" })}
              >
                <ChatCircleText size={16} /> Devolver ao StudioFlow
              </Button>
            )}
            {status !== "closed" && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void act({ action: "status", status: "closed" })}
              >
                Encerrar
              </Button>
            )}
            {summary.channel === "whatsapp" && (
              <Button
                variant="secondary"
                disabled={busy || loading || !!loadError || !!analysisReason}
                title={
                  analysisReason ||
                  "Reler o contexto e atender o pedido sem resposta"
                }
                onClick={() => void act({ action: "retry" })}
              >
                <ArrowClockwise size={16} /> Analisar e responder
              </Button>
            )}
          </div>
        )}
        <div className="chat-thread-mode">
          {status === "ai"
            ? "StudioFlow atende assuntos da casa. Ao responder, você assume esta conversa."
            : status === "human"
              ? "A equipe está no controle. O StudioFlow não responde enquanto você atende."
              : "Conversa encerrada. O histórico continua disponível."}
        </div>
        {canAnswer && summary.channel === "whatsapp" && (
          <div className="chat-thread-mode">
            {analysisReason ||
              "Ficou sem resposta? Analisar e responder relê as últimas seis mensagens, verifica o pedido e retoma o StudioFlow nesta conversa."}
          </div>
        )}
        {activity.length > 0 && (
          <details className="chat-activity">
            <summary>
              Atividade do atendimento <span>{activity.length}</span>
            </summary>
            <ol>
              {activity.map((item) => (
                <li key={item.id}>
                  <time>
                    {dayLabel(item.createdAt)} · {time(item.createdAt)}
                  </time>
                  <p>{item.body}</p>
                </li>
              ))}
            </ol>
          </details>
        )}
        {notice && (
          <div className="chat-analysis-notice" role="status">
            {notice}
          </div>
        )}
      </div>
      {run && !["SENT", "SILENT"].includes(run.state) && (
        <div
          className={`chat-thread-mode chat-run-status is-${run.state.toLowerCase()}`}
          role="status"
        >
          {(
            {
              RECEIVED: "Mensagem recebida",
              UNDERSTANDING: "Lendo a mensagem e o contexto",
              UNDERSTOOD: "Pedido entendido",
              DECIDING: "Conferindo o próximo passo",
              GENERATING: "Preparando resposta e consultando informações",
              VALIDATING: "Conferindo a resposta",
              SENDING: "Enviando no WhatsApp",
              SENT: "Resposta enviada ao WhatsApp",
              SILENT: "Sem resposta automática: mensagem fora do atendimento",
              RETRY: "Nova tentativa programada",
              FAILED: "Atendimento precisa de atenção",
            } as Record<string, string>
          )[run.state] || "Atendimento em andamento"}
          {run.state === "FAILED" && (
            <span>
              {" "}
              ·{" "}
              {run.error_code === "provider-timeout"
                ? "A IA demorou para responder."
                : run.error_code === "provider-auth"
                  ? "Confira a chave no cofre."
                  : run.error_code === "provider-limit" ||
                      run.error_code === "provider-balance"
                    ? "Confira o saldo e os limites do provedor."
                    : run.error_code === "delivery-unconfirmed"
                      ? "Confira a entrega no WhatsApp antes de reenviar."
                      : run.error_code === "daily-limit"
                        ? "Limite diário atingido. Aguarde a renovação ou ajuste nas configurações."
                        : run.error_code === "missing-key"
                          ? "Cadastre a chave de IA no cofre."
                          : run.error_code === "appointment-created"
                            ? "O agendamento já está na agenda. Confirme ao cliente sem criar outro."
                            : "Confira a configuração da IA ou assuma a conversa."}
            </span>
          )}
        </div>
      )}
      {loadError && (
        <div className="chat-load-error" role="alert">
          {loadError}
          <Button variant="ghost" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {syncUnavailable && (
        <p className="chat-analysis-notice" role="status">
          Não foi possível sincronizar o WhatsApp agora. Exibindo o histórico
          salvo; novas alterações aparecerão quando a conexão voltar.
        </p>
      )}
      <div
        className="chat-messages"
        role="log"
        aria-label="Histórico da conversa"
        aria-live="off"
        tabIndex={0}
        ref={list}
        onScroll={() => {
          if (list.current)
            nearBottom.current =
              list.current.scrollHeight -
                list.current.scrollTop -
                list.current.clientHeight <
              100;
        }}
      >
        {loading && (
          <p className="chat-muted" role="status">
            Carregando mensagens…
          </p>
        )}
        {!loading && !loadError && visibleMessages.length === 0 && (
          <p className="chat-muted">Nenhuma mensagem nesta conversa.</p>
        )}
        {visibleMessages.map((message, index) => {
          const previous = visibleMessages[index - 1];
          const newDay =
            !previous ||
            dayKey(new Date(message.createdAt)) !==
              dayKey(new Date(previous.createdAt));
          const interval = previous
            ? new Date(message.createdAt).getTime() -
              new Date(previous.createdAt).getTime()
            : Infinity;
          const grouped =
            !newDay &&
            previous.role === message.role &&
            interval >= 0 &&
            interval <= 5 * 60_000;
          const sender =
            message.role === "customer"
              ? who(summary)
              : message.role === "assistant"
                ? "StudioFlow"
                : "Equipe";
          return (
            <Fragment key={message.id}>
              {newDay && (
                <p className="chat-day">{dayLabel(message.createdAt)}</p>
              )}
              <div
                className={`chat-bubble is-${message.role} ${grouped ? "is-grouped" : ""}`}
              >
                {!grouped && (
                  <small className="chat-message-author">{sender}</small>
                )}
                <p>
                  {message.body}
                  <time
                    className="chat-message-time"
                    dateTime={message.createdAt}
                    title={`${sender} · ${dayLabel(message.createdAt)}`}
                  >
                    {messageTime(message.createdAt)}
                  </time>
                </p>
              </div>
            </Fragment>
          );
        })}
      </div>
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      {canAnswer && (
        <form className="chat-reply" onSubmit={reply}>
          <textarea
            ref={composer}
            rows={1}
            value={draft}
            maxLength={2000}
            placeholder={
              status === "ai"
                ? "Responder e assumir esta conversa"
                : "Escreva sua resposta"
            }
            onChange={(event) => onDraftChange(event.target.value)}
            onFocus={() => setControlsOpen(false)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                window.matchMedia("(hover: hover) and (pointer: fine)")
                  .matches &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            aria-label="Resposta"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Enviar"
          >
            <ArrowUp weight="bold" size={18} />
          </button>
        </form>
      )}
      {canAnswer && (
        <p className="chat-composer-note">
          <span className="chat-keyboard-hint">
            Enter para enviar · Shift + Enter para nova linha
          </span>
          <span>
            {status === "ai"
              ? "Ao enviar, você assume o atendimento e pausa o StudioFlow nesta conversa."
              : status === "closed"
                ? "Ao enviar, você reabre e assume esta conversa."
                : "Você está atendendo · StudioFlow pausado nesta conversa"}
          </span>
        </p>
      )}
    </>
  );
}
