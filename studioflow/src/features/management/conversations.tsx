"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUp,
  ChatCircleText,
  Robot,
  UserCircle,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { InstagramIcon, WhatsAppIcon } from "@/components/brand-icons";
import { Avatar, Button, EmptyState, PageHeader } from "@/components/ui";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { formatPhone } from "@/lib/utils";
import type {
  ConversationMessage,
  ConversationStatus,
  ConversationSummary,
  Store,
} from "@/types";
import { ManagementBoundary } from "./shared";
import "./conversations.css";
import { ModuleGate } from "@/features/dashboard/module-lock";

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
  ai: "Atendente virtual",
  human: "Equipe atendendo",
  closed: "Encerrada",
};
const time = (iso: string) => {
  const date = new Date(iso);
  const today = new Date().toDateString() === date.toDateString();
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    ...(today ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit" }),
  }).format(date);
};
const who = (item: Pick<ConversationSummary, "contactName" | "contactPhone" | "channel">) =>
  item.contactName ||
  (item.contactPhone
    ? formatPhone(item.contactPhone)
    : item.channel === "web"
      ? "Visitante do site"
      : item.channel === "instagram"
        ? "Cliente do Instagram"
        : "Cliente");

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
  const canAnswer = ["owner", "admin", "manager", "receptionist"].includes(role || "");
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [active, setActive] = useState<string>("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setList(await request<ConversationSummary[]>("/api/workspace/conversations"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar.");
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
  return (
    <div className={`chat-page ${active ? "has-thread" : ""}`}>
      <PageHeader
        title="Conversas"
        description="O que os clientes falam com a atendente virtual, no site e no WhatsApp. Assuma quando quiser."
      />
      {!settings.assistantEnabled && (
        <div className="chat-notice">
          <Warning size={18} />
          <span>
            A atendente virtual está desligada. Ligue em{" "}
            <Link href="/dashboard/configuracoes">Configurações → Recepcionista</Link>.
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
          {list === null ? (
            <p className="chat-muted">Carregando…</p>
          ) : list.length === 0 ? (
            <EmptyState
              title="Nenhuma conversa ainda"
              description="Quando um cliente falar com a atendente pelo site ou pelo WhatsApp, a conversa aparece aqui."
            />
          ) : (
            list.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`chat-item ${item.id === active ? "is-active" : ""} ${item.unread ? "is-unread" : ""}`}
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                onClick={() => setActive(item.id)}
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
                  <span>{item.preview}</span>
                </span>
                <span className="chat-item-side">
                  <small>{time(item.lastMessageAt)}</small>
                  {item.unread > 0 ? (
                    <b>{item.unread}</b>
                  ) : (
                    <i className={`chat-dot is-${item.status}`} title={statusText[item.status]} />
                  )}
                </span>
              </button>
            ))
          )}
        </aside>
        <section className="chat-thread" aria-label="Conversa">
          {current ? (
            <Thread
              key={current.id}
              summary={current}
              canAnswer={canAnswer}
              onBack={() => setActive("")}
              onChange={refresh}
            />
          ) : (
            <div className="chat-empty">
              <Robot size={34} weight="duotone" />
              <p>Escolha uma conversa para ler. Você pode assumir a qualquer momento.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Thread({
  summary,
  canAnswer,
  onBack,
  onChange,
}: {
  summary: ConversationSummary;
  canAnswer: boolean;
  onBack: () => void;
  onChange: () => Promise<void>;
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [status, setStatus] = useState(summary.status);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const data = await request<{
      conversation: ConversationSummary;
      messages: ConversationMessage[];
    }>(`/api/workspace/conversations/${summary.id}`);
    setMessages(data.messages);
    setStatus(data.conversation.status);
  }, [summary.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the thread from the server
    void load().catch(() => undefined);
    const timer = window.setInterval(() => void load().catch(() => undefined), 6000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);

  async function act(body: object) {
    setBusy(true);
    setError("");
    try {
      await request(`/api/workspace/conversations/${summary.id}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
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
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    if (await act({ action: "reply", body: draft })) setDraft("");
  }

  return (
    <>
      <header className="chat-thread-head">
        <button type="button" className="chat-back" onClick={onBack} aria-label="Voltar para a lista">
          <ArrowLeft size={18} />
        </button>
        <Avatar name={who(summary)} size={40} />
        <div>
          <strong>{who(summary)}</strong>
          <small>
            {summary.channel === "whatsapp"
              ? "WhatsApp"
              : summary.channel === "instagram"
                ? "Instagram Direct"
                : "Chat do site"}
            {summary.contactPhone && ` · ${formatPhone(summary.contactPhone)}`}
          </small>
        </div>
        <span className={`chat-status is-${status}`}>{statusText[status]}</span>
      </header>
      {canAnswer && (
        <div className="chat-actions">
          {status !== "human" && (
            <Button variant="secondary" disabled={busy} onClick={() => void act({ action: "status", status: "human" })}>
              <UserCircle size={16} /> Assumir
            </Button>
          )}
          {status !== "ai" && (
            <Button variant="secondary" disabled={busy} onClick={() => void act({ action: "status", status: "ai" })}>
              <Robot size={16} /> Devolver para a atendente
            </Button>
          )}
          {status !== "closed" && (
            <Button variant="ghost" disabled={busy} onClick={() => void act({ action: "status", status: "closed" })}>
              Encerrar
            </Button>
          )}
        </div>
      )}
      <div className="chat-messages" ref={list}>
        {messages.map((message) =>
          message.role === "event" ? (
            <p key={message.id} className="chat-event">
              {message.body} · {time(message.createdAt)}
            </p>
          ) : (
            <div key={message.id} className={`chat-bubble is-${message.role}`}>
              <small>
                {message.role === "customer"
                  ? who(summary)
                  : message.role === "assistant"
                    ? "Atendente virtual"
                    : "Equipe"}{" "}
                · {time(message.createdAt)}
              </small>
              <p>{message.body}</p>
            </div>
          ),
        )}
      </div>
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      {canAnswer && (
        <form className="chat-reply" onSubmit={reply}>
          <textarea
            rows={1}
            value={draft}
            maxLength={2000}
            placeholder={
              status === "ai"
                ? "Responder como equipe (a atendente para)"
                : "Escreva sua resposta"
            }
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            aria-label="Resposta"
          />
          <button type="submit" disabled={busy || !draft.trim()} aria-label="Enviar">
            <ArrowUp weight="bold" size={18} />
          </button>
        </form>
      )}
    </>
  );
}
