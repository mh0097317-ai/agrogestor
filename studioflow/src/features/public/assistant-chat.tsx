"use client";

import {
  ArrowUp,
  ChatCircleText,
  Sparkle,
  X,
} from "@phosphor-icons/react/dist/ssr";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { Business, ConversationMessage } from "@/types";
import { monogram } from "@/lib/utils";
import { PublicImage } from "./public-ui";
import { publicRequest } from "./use-public-catalog";
import "./assistant-chat.css";

interface ChatView {
  token: string;
  status: "ai" | "human" | "closed";
  messages: ConversationMessage[];
  assistantName: string;
}

const key = (slug: string) => `studioflow:chat:${slug}`;
const readToken = (slug: string) => {
  try {
    const value = localStorage.getItem(key(slug)) || "";
    return /^[a-f0-9]{64}$/.test(value) ? value : "";
  } catch {
    return "";
  }
};
const suggestions = [
  "Quero marcar um horário",
  "Qual o próximo horário livre?",
  "Quanto custa um corte?",
];

/** Turns URLs in a message into links (booking receipts, Pix). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a key={index} href={part} target="_blank" rel="noreferrer">
            {part.includes("/booking/") ? "Abrir comprovante" : part}
          </a>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Chat with the business's AI receptionist: answers questions, finds free
 * times and books. The team can take over from the dashboard.
 */
export function AssistantChat({
  business,
  name,
  raised = false,
}: {
  business: Business;
  name: string;
  /** Lift the button above the mobile booking dock. */
  raised?: boolean;
}) {
  const slug = business.slug;
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [view, setView] = useState<ChatView | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(
    async (value: string) => {
      try {
        setView(
          await publicRequest<ChatView>(
            `/api/public/${encodeURIComponent(slug)}/chat?token=${value}`,
          ),
        );
      } catch {
        // An expired conversation simply starts over.
      }
    },
    [slug],
  );

  function openChat() {
    setOpen(true);
    const saved = readToken(slug);
    if (saved && saved !== token) {
      setToken(saved);
      void load(saved);
    }
    window.setTimeout(() => input.current?.focus(), 80);
  }

  // While open, pick up answers typed by the team.
  useEffect(() => {
    if (!open || !token) return;
    const timer = window.setInterval(() => {
      if (!pending) void load(token);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [open, token, pending, load]);

  const messages = view?.messages || [];
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending, open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setPending(message);
    setDraft("");
    setError("");
    try {
      const result = await publicRequest<ChatView>(
        `/api/public/${encodeURIComponent(slug)}/chat`,
        {
          method: "POST",
          body: JSON.stringify({ token: token || undefined, message }),
        },
      );
      setView(result);
      setToken(result.token);
      try {
        localStorage.setItem(key(slug), result.token);
      } catch {
        // The chat still works for this visit.
      }
    } catch (cause) {
      setDraft(message);
      setError(
        cause instanceof Error ? cause.message : "Não foi possível enviar. Tente de novo.",
      );
    } finally {
      setPending(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  const mark = business.logo ? (
    <PublicImage src={business.logo} alt="" className="ac-mark has-logo" />
  ) : (
    <span className="ac-mark">{monogram(business.name)}</span>
  );

  return (
    <>
      <button
        type="button"
        className={`ac-launcher ${raised ? "is-raised" : ""} ${open ? "is-hidden" : ""}`}
        onClick={openChat}
        aria-label={`Conversar com ${name}`}
      >
        <ChatCircleText weight="duotone" size={22} />
        <span>Tirar dúvidas e agendar</span>
      </button>
      {open && (
        <section className="ac-panel" role="dialog" aria-label={`Conversa com ${name}`}>
          <header className="ac-head">
            {mark}
            <div>
              <strong>{name}</strong>
              <small>
                {view?.status === "human"
                  ? "Equipe da casa no atendimento"
                  : "Atendente virtual · responde na hora"}
              </small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar conversa">
              <X weight="bold" size={18} />
            </button>
          </header>
          <div className="ac-list" ref={list} aria-live="polite">
            <div className="ac-msg is-assistant ac-hello">
              <p>
                Oi! Sou {name}, da {business.name}. Posso ver horários livres, marcar e tirar
                dúvidas sobre serviços e preços.
              </p>
            </div>
            {messages.map((message) => (
              <div key={message.id} className={`ac-msg is-${message.role}`}>
                {message.role === "staff" && <small>Equipe</small>}
                <p>
                  <Linkified text={message.body} />
                </p>
              </div>
            ))}
            {pending && (
              <>
                <div className="ac-msg is-customer is-sending">
                  <p>{pending}</p>
                </div>
                <div className="ac-typing" aria-label={`${name} está escrevendo`}>
                  <i />
                  <i />
                  <i />
                </div>
              </>
            )}
            {!messages.length && !pending && (
              <div className="ac-suggestions">
                {suggestions.map((item) => (
                  <button key={item} type="button" onClick={() => void send(item)}>
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
          {error && (
            <p className="ac-error" role="alert">
              {error}
            </p>
          )}
          <form className="ac-form" onSubmit={submit}>
            <textarea
              ref={input}
              rows={1}
              value={draft}
              maxLength={1000}
              placeholder="Escreva sua mensagem"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
              aria-label="Mensagem"
            />
            <button type="submit" disabled={!draft.trim() || !!pending} aria-label="Enviar">
              <ArrowUp weight="bold" size={18} />
            </button>
          </form>
          <p className="ac-note">
            <Sparkle weight="fill" size={11} /> Atendimento com IA. Confira data e hora no
            comprovante.
          </p>
        </section>
      )}
    </>
  );
}
