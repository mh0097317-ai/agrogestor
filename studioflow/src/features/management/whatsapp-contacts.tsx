"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Avatar } from "@/components/ui";
import { formatPhone } from "@/lib/utils";
import type { WhatsAppContact } from "@/lib/whatsapp-contacts";

async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Não foi possível carregar os contatos.");
  return result;
}
export function WhatsAppContacts({
  channel,
  search,
  onOpen,
}: {
  channel: string;
  search: string;
  onOpen: (id: string) => Promise<void>;
}) {
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]),
    [total, setTotal] = useState(0),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const professionalId = channel.startsWith("professional:")
    ? channel.slice(13)
    : undefined;
  const supported = channel === "shop" || !!professionalId;
  const generation = useRef(0);
  const currentSearch = useRef(search);
  const load = useCallback(
    async (offset = 0) => {
      if (currentSearch.current !== search) return;
      const current = generation.current;
      const query = new URLSearchParams({
        offset: String(offset),
        search,
        ...(professionalId ? { professionalId } : {}),
      });
      const result = await api<{ contacts: WhatsAppContact[]; total: number }>(
        `/api/workspace/whatsapp-contacts?${query}`,
      );
      if (current !== generation.current) return;
      setContacts((previous) =>
        offset
          ? Array.from(
              new Map(
                [...previous, ...result.contacts].map((c) => [c.id, c]),
              ).values(),
            )
          : result.contacts,
      );
      setTotal(result.total);
    },
    [professionalId, search],
  );
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    currentSearch.current = search;
    generation.current += 1;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- channel/search starts a new external phone-book load
    setContacts([]);
    setTotal(0);
    setError("");
    setNotice("");
    const timer = setTimeout(() => {
      void load().catch((e) => {
        if (!cancelled) setError(e.message);
      });
    }, 250);
    return () => {
      cancelled = true;
      generation.current += 1;
      clearTimeout(timer);
    };
  }, [load, supported, search]);
  async function sync() {
    setBusy("sync");
    setError("");
    setNotice("");
    let imported = 0;
    try {
      let page: number | null = 1;
      while (page !== null && page <= 500) {
        const result: { imported: number; nextPage: number | null } = await api(
          "/api/workspace/whatsapp-contacts",
          { professionalId, page },
        );
        imported += result.imported;
        page = result.nextPage;
        setNotice(`Sincronizando… ${imported} contatos encontrados.`);
      }
      if (page !== null)
        throw new Error(
          "A sincronização atingiu o limite por operação. Atualize a lista e continue depois.",
        );
      await load();
      setNotice(
        `${imported} contatos sincronizados. Nenhuma mensagem foi enviada.`,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível sincronizar.",
      );
      await load().catch(() => {});
    } finally {
      setBusy("");
    }
  }
  async function open(id: string) {
    setBusy(id);
    setError("");
    try {
      const result = await api<{ id: string }>(
        "/api/workspace/whatsapp-contacts",
        { action: "open", id },
      );
      await onOpen(result.id);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível abrir.",
      );
    } finally {
      setBusy("");
    }
  }
  async function loadMore() {
    setBusy("load");
    try {
      await load(contacts.length);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível carregar.",
      );
    } finally {
      setBusy("");
    }
  }
  if (!supported)
    return (
      <div className="chat-filter-empty">
        <strong>Escolha um WhatsApp</strong>
        <p>
          Selecione o número da loja ou de um profissional no filtro acima. Os
          contatos de cada número ficam separados.
        </p>
      </div>
    );
  return (
    <div className="chat-contacts">
      <div className="chat-contact-tools">
        <Button
          variant="secondary"
          disabled={!!busy}
          onClick={() => void sync()}
        >
          {busy === "sync" ? "Sincronizando…" : "Sincronizar contatos reais"}
        </Button>
        <p>
          A lista vem deste WhatsApp conectado. Não inicia atendimento
          automático nem importa conversas pessoais.
        </p>
        <Link href="/dashboard/configuracoes?aba=whatsapp">
          Conectar meu WhatsApp
        </Link>
      </div>
      {notice && (
        <p className="chat-muted" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {contacts.map((contact) => (
        <button
          type="button"
          key={contact.id}
          className="chat-item"
          disabled={!!busy}
          onClick={() => void open(contact.id)}
        >
          <Avatar name={contact.name || contact.phone} size={40} />
          <span className="chat-item-main">
            <strong>{contact.name || formatPhone(contact.phone)}</strong>
            <span>+{contact.phone}</span>
          </span>
        </button>
      ))}
      {!contacts.length && !error && (
        <p className="chat-muted">
          Nenhum contato nesta lista. Sincronize o número conectado ou ajuste a
          busca.
        </p>
      )}
      {contacts.length < total && (
        <Button
          variant="ghost"
          disabled={!!busy}
          onClick={() => void loadMore()}
        >
          Carregar mais contatos ({contacts.length} de {total})
        </Button>
      )}
    </div>
  );
}
