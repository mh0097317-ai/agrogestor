"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, FormSection } from "@/components/ui";
import { FormError } from "./shared";
import type { Store, WhatsAppLink } from "@/types";
import { WhatsAppIcon } from "@/components/brand-icons";
import { QrCode } from "@phosphor-icons/react/dist/ssr";
interface View extends WhatsAppLink {
  ready: boolean;
  qr?: string;
}
export function ProfessionalWhatsApp({
  store,
  canManage,
  onSaved,
}: {
  store: Store;
  canManage: boolean;
  onSaved: () => Promise<void>;
}) {
  return (
    <FormSection
      title="WhatsApp dos profissionais"
      description="Cada profissional pode conectar seu número. O atendimento usa o nome dele e agenda diretamente com ele, mantendo o número da loja independente."
    >
      <div className="professional-connections">
        {store.professionals
          .filter((p) => p.active)
          .map((p) => (
            <ProfessionalConnection
              key={p.id}
              id={p.id}
              name={p.name}
              link={store.professionalWhatsAppLinks?.find(
                (l) => l.professionalId === p.id,
              )}
              canManage={canManage || store.viewer?.professionalId === p.id}
              onSaved={onSaved}
              demo={store.mode === "demo"}
              ready={store.evolutionReady !== false}
            />
          ))}
      </div>
      <p className="payment-copy">
        Conecte apenas números autorizados pelo estabelecimento e pelo
        profissional. Se o cliente perguntar, o atendimento informa que usa a
        assistente do profissional.
      </p>
    </FormSection>
  );
}
export function ProfessionalConnection({
  id,
  name,
  link,
  canManage,
  onSaved,
  demo,
  ready,
}: {
  id: string;
  name: string;
  link?: WhatsAppLink;
  canManage: boolean;
  onSaved: () => Promise<void>;
  demo: boolean;
  ready: boolean;
}) {
  const [view, setView] = useState<View>({
    ...link,
    status: link?.status || "close",
    phone: link?.phone || "",
    profileName: link?.profileName || "",
    ready,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const api = useCallback(
    async (method: string) => {
      const response = await fetch(
        `/api/workspace/whatsapp-link?professionalId=${id}`,
        {
          method,
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Não foi possível conectar.");
      return result as View;
    },
    [id],
  );
  async function connect() {
    setBusy(true);
    setError("");
    try {
      setView(await api("POST"));
      setUnverified(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na conexão.");
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    setBusy(true);
    setError("");
    try {
      setView(await api("GET"));
      setUnverified(false);
      await onSaved();
    } catch (e) {
      setUnverified(true);
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível verificar a conexão.",
      );
    } finally {
      setBusy(false);
    }
  }
  const waiting = view.status === "connecting" && !!view.qr;
  useEffect(() => {
    if (!waiting) return;
    let active = true,
      inflight = false;
    const timer = window.setInterval(async () => {
      if (inflight) return;
      inflight = true;
      try {
        const next = await api("GET");
        if (active && next.status === "open") {
          setView(next);
          setUnverified(false);
          await onSaved();
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar o status.",
          );
      } finally {
        inflight = false;
      }
    }, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [waiting, api, onSaved]);
  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      await api("DELETE");
      setView({ status: "close", phone: "", profileName: "", ready });
      await onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível desconectar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="professional-connection">
      <header>
        <WhatsAppIcon size={22} />
        <div>
          <strong>{name}</strong>
          <span>
            {view.status === "open"
              ? view.phone || "WhatsApp conectado"
              : "Número individual do profissional"}
          </span>
        </div>
        <em>
          {unverified
            ? "Sem confirmação"
            : view.status === "open"
              ? "Conectado"
              : waiting
                ? "Aguardando leitura"
                : "Desconectado"}
        </em>
      </header>
      {waiting && (
        <div className="professional-qr">
          <img
            src={view.qr}
            alt={`QR Code para conectar o WhatsApp de ${name}`}
          />
          <div>
            <p>
              Abra o WhatsApp de {name} → Aparelhos conectados → Conectar um
              aparelho.
            </p>
            <p>Leia este QR Code com o celular daquele profissional.</p>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void connect()}
            >
              Atualizar QR Code
            </Button>
          </div>
        </div>
      )}
      {canManage && (
        <div className="professional-connect-actions">
          <Button
            variant="secondary"
            disabled={busy || demo || !ready}
            onClick={() => void sync()}
          >
            {busy ? "Aguarde…" : "Sincronizar conexão"}
          </Button>
          {view.status === "open" ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              Desconectar número
            </Button>
          ) : (
            !waiting && (
              <Button
                variant="secondary"
                disabled={busy || demo || !ready}
                onClick={() => void connect()}
              >
                <QrCode size={16} />
                {busy ? "Gerando código…" : `Conectar WhatsApp de ${name}`}
              </Button>
            )
          )}
        </div>
      )}
      {demo && (
        <p className="payment-copy">
          Disponível com números reais no ambiente publicado.
        </p>
      )}
      {!ready && (
        <p className="payment-warning">
          A conexão aguarda a configuração do servidor pela plataforma.
        </p>
      )}
      <FormError error={error} />
    </article>
  );
}
