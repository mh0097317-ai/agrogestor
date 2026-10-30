"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowClockwise,
  ArrowUp,
  ListBullets,
  Flask,
} from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import type { ConversationMessage, Store } from "@/types";
import "./assistant-simulator.css";

interface Menu {
  title: string;
  button: string;
  rows: { id: string; title: string; description: string }[];
}
type Item =
  | { kind: "customer"; body: string }
  | { kind: "assistant"; body: string; menu: Menu | null }
  | { kind: "note"; body: string };

const starters = [
  "Boa noite",
  "Quanto custa o corte?",
  "Quero marcar amanhã à tarde",
  "Quero remarcar meu horário",
  "Você viu o jogo ontem?",
];
const formatted = (text: string) =>
  text
    .split(/(\*[^*\n]+\*)/g)
    .map((part, i) =>
      /^\*[^*\n]+\*$/.test(part) ? (
        <strong key={i}>{part.slice(1, -1)}</strong>
      ) : (
        <span key={i}>{part}</span>
      ),
    );

/**
 * The owner's test chat: the receptionist answers through the same path as
 * WhatsApp, menus included, without sending messages or saving bookings.
 */
export function AssistantSimulator({ store }: { store: Store }) {
  const [items, setItems] = useState<Item[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [handedOff, setHandedOff] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [as, setAs] = useState("");
  const [sheet, setSheet] = useState<Menu | null>(null);
  const list = useRef<HTMLDivElement>(null);
  // Fixed when the test chat opens; enough to list bookings still ahead.
  const [openedAt] = useState(() => Date.now());
  // Customers with a booking ahead, to test cancelling or moving it.
  const booked = store.appointments
    .filter(
      (a) =>
        ["confirmed", "pending"].includes(a.status) &&
        Date.parse(a.start) > openedAt &&
        a.customerPhone,
    )
    .sort((a, b) => a.start.localeCompare(b.start))
    .filter(
      (a, i, all) =>
        all.findIndex((b) => b.customerPhone === a.customerPhone) === i,
    )
    .slice(0, 8);
  const persona = booked.find((a) => a.customerPhone === as);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [items, busy]);

  function reset() {
    setItems([]);
    setMessages([]);
    setHistory([]);
    setHandedOff(false);
    setError("");
    setSheet(null);
  }
  async function send(value: string, shown = value) {
    if (!value.trim() || busy) return;
    setSheet(null);
    setError("");
    setBusy(true);
    setItems((current) => [...current, { kind: "customer", body: shown }]);
    try {
      const response = await fetch("/api/workspace/assistant/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: value,
          phone: persona?.customerPhone || "",
          name: persona?.customerName || "",
          messages,
          history,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Não foi possível testar agora.");
      setMessages(data.messages || []);
      setHistory(data.history || []);
      setHandedOff(data.status === "human");
      setItems((current) => [
        ...current,
        ...(data.replies || []).map(
          (r: { body: string; menu: Menu | null }) =>
            ({ kind: "assistant", body: r.body, menu: r.menu }) as Item,
        ),
        ...(data.notes || []).map(
          (n: string) => ({ kind: "note", body: n }) as Item,
        ),
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text;
    setText("");
    void send(value);
  }
  return (
    <section className="sim" aria-label="Testar a recepcionista">
      <header className="sim-intro">
        <span className="sim-kicker">
          <Flask size={15} weight="duotone" /> Teste sem risco
        </span>
        <h2>Converse com a sua recepcionista</h2>
        <p>
          Ela responde do mesmo jeito que no WhatsApp, com as mesmas listas de
          horários. Nada é enviado a clientes e nenhum horário é marcado.
        </p>
        <label className="sim-persona">
          <span>Testar como</span>
          <select
            value={as}
            disabled={busy}
            onChange={(event) => {
              setAs(event.target.value);
              reset();
            }}
          >
            <option value="">Cliente novo</option>
            {booked.map((a) => (
              <option key={a.id} value={a.customerPhone}>
                {a.customerName} (tem horário marcado)
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="sim-phone">
        <div className="sim-bar">
          <span className="sim-avatar" aria-hidden="true">
            {store.business.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="sim-who">
            <strong>{store.business.name}</strong>
            <small>{busy ? "digitando…" : "WhatsApp · modo de teste"}</small>
          </span>
          <button
            type="button"
            className="sim-reset"
            onClick={reset}
            disabled={busy || !items.length}
            aria-label="Recomeçar o teste"
            title="Recomeçar"
          >
            <ArrowClockwise size={18} />
          </button>
        </div>
        <div className="sim-chat" ref={list} role="log" aria-live="polite">
          {!items.length && (
            <div className="sim-empty">
              <WhatsAppIcon size={26} />
              <p>Escreva como se fosse um cliente, ou comece por aqui:</p>
              <div className="sim-starters">
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    disabled={busy}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {items.map((item, i) =>
            item.kind === "note" ? (
              <p key={i} className="sim-note">
                {item.body}
              </p>
            ) : (
              <div key={i} className={`sim-bubble is-${item.kind}`}>
                <p>{formatted(item.body)}</p>
                {item.kind === "assistant" && item.menu && (
                  <button
                    type="button"
                    className="sim-menu-button"
                    onClick={() => setSheet(item.menu)}
                    disabled={busy}
                  >
                    <ListBullets size={16} /> {item.menu.button}
                  </button>
                )}
              </div>
            ),
          )}
          {busy && (
            <div
              className="sim-bubble is-assistant is-typing"
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
            </div>
          )}
          {handedOff && (
            <p className="sim-note is-handoff">
              Aqui a conversa passaria para a equipe e a recepcionista pararia
              de responder. Toque em recomeçar para testar de novo.
            </p>
          )}
        </div>
        {sheet && (
          <div className="sim-sheet" role="dialog" aria-label={sheet.title}>
            <div className="sim-sheet-head">
              <strong>{sheet.title}</strong>
              <button type="button" onClick={() => setSheet(null)}>
                Fechar
              </button>
            </div>
            <ul>
              {sheet.rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void send(row.id, row.title)}
                  >
                    <strong>{row.title}</strong>
                    {row.description && <small>{row.description}</small>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p className="sim-error" role="alert">
            {error}
          </p>
        )}
        <form className="sim-compose" onSubmit={submit}>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              handedOff ? "A equipe assumiria aqui" : "Mensagem do cliente"
            }
            maxLength={1000}
            disabled={busy || handedOff}
            aria-label="Mensagem do cliente"
          />
          <button
            type="submit"
            disabled={busy || handedOff || !text.trim()}
            aria-label="Enviar"
          >
            <ArrowUp size={18} weight="bold" />
          </button>
        </form>
      </div>
      <p className="sim-foot">
        Cada resposta do teste usa a IA de verdade e conta no limite diário de
        atendimentos.
      </p>
    </section>
  );
}
