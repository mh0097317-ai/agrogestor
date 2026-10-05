"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  DeviceMobile,
  LinkBreak,
  QrCode,
} from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import { Button, FormSection } from "@/components/ui";
import { useToast } from "@/components/toast";
import { formatPhone } from "@/lib/utils";
import type { Store } from "@/types";
import { FormError } from "./shared";
import "./whatsapp-settings.css";

interface LinkView {
  status: "connecting" | "open" | "close";
  phone: string;
  profileName: string;
  qr?: string;
  pairingCode?: string;
  ready: boolean;
}

async function send<T>(method: string, body?: unknown): Promise<T> {
  const response = await fetch("/api/workspace/whatsapp-link", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data as T;
}

/** WhatsApp's *bold* as it shows on the phone. */
const waText = (text: string) =>
  text.split(/(\*[^*\n]+\*)/g).map((part, index) =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
      <b key={index}>{part.slice(1, -1)}</b>
    ) : (
      part
    ),
  );

const shownPhone = (phone: string) => {
  const local = phone.startsWith("55") ? phone.slice(2) : phone;
  return local.length >= 10 ? `+55 ${formatPhone(local)}` : `+${phone}`;
};

/**
 * Configurações → WhatsApp: a loja conecta o próprio WhatsApp lendo um QR
 * Code. Por ele a recepcionista responde e saem os avisos automáticos.
 */
export function WhatsAppSettings({
  store,
  canManage,
  onSaved,
}: {
  store: Store;
  canManage: boolean;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [view, setView] = useState<LinkView | null>(
    store.whatsappLink
      ? { ...store.whatsappLink, ready: store.evolutionReady !== false }
      : null,
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notify, setNotify] = useState(store.settings.notifyProfessionals !== false);
  const qrAt = useRef(0);
  const connected = view?.status === "open";
  const waiting = view?.status === "connecting" && !!view.qr;

  const start = useCallback(async () => {
    setBusy("qr");
    setError("");
    try {
      const next = await send<LinkView>("POST");
      qrAt.current = Date.now();
      setView(next);
      if (!next.ready)
        setError("O WhatsApp por QR Code ainda está sendo ligado pela equipe StudioFlow. Tente mais tarde.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o QR Code.");
    } finally {
      setBusy("");
    }
  }, []);

  // While the QR is on screen, check every 3 s whether it was read.
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await send<LinkView>("GET");
        if (next.status === "open") {
          setView(next);
          toast("WhatsApp da loja conectado.");
          await onSaved();
        } else if (Date.now() - qrAt.current > 45_000) {
          // The QR expires: a new one appears by itself.
          void start();
        }
      } catch {
        // Next round tries again.
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [waiting, start, toast, onSaved]);

  async function unlink() {
    setBusy("off");
    setError("");
    try {
      await send("DELETE");
      setView(null);
      toast("WhatsApp desconectado.");
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível desconectar.");
    } finally {
      setBusy("");
    }
  }
  async function simulate() {
    setBusy("sim");
    try {
      const next = await send<Omit<LinkView, "ready">>("POST", { simulate: true });
      setView({ ...next, ready: true });
      toast("WhatsApp da loja conectado (demonstração).");
      await onSaved();
    } finally {
      setBusy("");
    }
  }
  async function toggleNotify(value: boolean) {
    setNotify(value);
    try {
      await send("PATCH", { notifyProfessionals: value });
      toast(value ? "Os profissionais vão receber os avisos." : "Avisos aos profissionais desligados.");
    } catch (cause) {
      setNotify(!value);
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    }
  }

  return (
    <>
      <FormSection
        title="Conexão"
        description="Conecte o WhatsApp da barbearia lendo um QR Code, como no WhatsApp Web. Por ele a recepcionista responde os clientes e saem os avisos automáticos."
      >
        {connected ? (
          <div className="wa-linked">
            <span className="wa-linked-mark" aria-hidden="true">
              <WhatsAppIcon size={26} />
              <CheckCircle size={18} weight="fill" />
            </span>
            <div>
              <strong>{view.profileName || "WhatsApp conectado"}</strong>
              <span>{view.phone ? shownPhone(view.phone) : "Número da loja"}</span>
            </div>
            {canManage && (
              <Button type="button" variant="secondary" disabled={!!busy} onClick={unlink}>
                <LinkBreak size={16} />
                {busy === "off" ? "Desconectando…" : "Desconectar"}
              </Button>
            )}
          </div>
        ) : waiting ? (
          <div className="wa-qr">
            <figure>
              <img src={view.qr} alt="QR Code para conectar o WhatsApp da loja" />
              <span className="wa-qr-scan" aria-hidden="true" />
            </figure>
            <div>
              <ol className="payment-steps">
                <li>Abra o WhatsApp no celular da loja.</li>
                <li>
                  Toque em <b>Mais opções</b> (ou <b>Configurações</b> no iPhone) e em{" "}
                  <b>Aparelhos conectados</b>.
                </li>
                <li>
                  Toque em <b>Conectar um aparelho</b> e aponte a câmera para este código.
                </li>
              </ol>
              {view.pairingCode && (
                <p className="wa-pair">
                  Ou use o código <b>{view.pairingCode}</b> em “Conectar com número de telefone”.
                </p>
              )}
              <p className="wa-wait" role="status">
                <i /> Esperando a leitura do código…
              </p>
              <div className="wa-actions">
                <Button type="button" variant="secondary" disabled={!!busy} onClick={start}>
                  <ArrowClockwise size={16} /> Gerar outro código
                </Button>
                {store.mode === "demo" && (
                  <Button type="button" disabled={!!busy} onClick={simulate}>
                    <DeviceMobile size={16} /> Simular leitura
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="wa-start">
            <span className="wa-start-icon" aria-hidden="true">
              <WhatsAppIcon size={34} />
            </span>
            <div>
              <strong>Sem chave, sem cadastro na Meta.</strong>
              <p>
                Use o mesmo número que a barbearia já usa. O WhatsApp continua funcionando
                normal no celular.
              </p>
            </div>
            {canManage ? (
              <Button type="button" disabled={!!busy} onClick={start}>
                <QrCode size={17} />
                {busy === "qr" ? "Gerando código…" : "Conectar com QR Code"}
              </Button>
            ) : (
              <p className="payment-copy">Peça para o dono conectar o WhatsApp da loja.</p>
            )}
          </div>
        )}
        <FormError error={error} />
      </FormSection>
      <FormSection
        title="Avisos automáticos"
        description="Mensagens que saem sozinhas pelo WhatsApp da loja."
      >
        <label className="wa-toggle">
          <input
            type="checkbox"
            checked={notify}
            disabled={!canManage}
            onChange={(event) => void toggleNotify(event.target.checked)}
          />
          <span>
            <strong>Avisar o profissional a cada agendamento</strong>
            <small>
              Quem vai atender recebe no WhatsApp dele o cliente, o serviço, o dia e o horário.
              Cadastre o WhatsApp de cada um em Equipe.
            </small>
          </span>
        </label>
        {!connected && (
          <p className="payment-warning">
            Os avisos começam a sair assim que o WhatsApp da loja estiver conectado.
          </p>
        )}
        {store.mode === "demo" && !!store.outbox?.length && (
          <div className="wa-outbox">
            <span className="sheet-eyebrow">Últimos avisos (demonstração)</span>
            {[...store.outbox]
              .reverse()
              .slice(0, 3)
              .map((item) => (
                <figure key={item.at + item.to} className="wa-bubble">
                  <figcaption>Para {shownPhone(`55${item.to}`)}</figcaption>
                  <p>{waText(item.body)}</p>
                </figure>
              ))}
          </div>
        )}
      </FormSection>
    </>
  );
}
