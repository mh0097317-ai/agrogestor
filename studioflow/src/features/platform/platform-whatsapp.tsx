"use client";

import { useEffect, useState } from "react";
import { CheckCircle, QrCode } from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";

interface PlatformLink {
  ready: boolean;
  status: "connecting" | "open" | "close";
  phone: string;
  profileName: string;
  qr?: string;
  pairingCode?: string;
}

async function call(method: string): Promise<PlatformLink> {
  const response = await fetch("/api/admin/whatsapp", { method });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível.");
  return data;
}

/**
 * O número do StudioFlow que manda os lembretes de mensalidade. A equipe
 * conecta lendo o QR Code com o WhatsApp da empresa.
 */
export function PlatformWhatsApp() {
  const [link, setLink] = useState<PlatformLink | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    call("GET").then(setLink).catch(() => setLink(null));
  }, []);
  const waiting = link?.status === "connecting" && !!link.qr;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(async () => {
      const next = await call("GET").catch(() => null);
      if (next?.status === "open") setLink(next);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [waiting]);
  if (!link) return null;
  async function start() {
    setBusy(true);
    setError("");
    try {
      setLink(await call("POST"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pf-wa">
      <WhatsAppIcon size={26} />
      <div>
        <strong>WhatsApp do StudioFlow</strong>
        {link.status === "open" ? (
          <span>
            <CheckCircle size={14} weight="fill" /> Conectado
            {link.phone ? ` · +${link.phone}` : ""}. Os lembretes de mensalidade saem por ele.
          </span>
        ) : !link.ready ? (
          <span>Configure a Evolution API na Vercel para mandar os lembretes de mensalidade.</span>
        ) : (
          <span>Conecte o número da empresa: os lembretes de mensalidade saem por ele.</span>
        )}
        {error && <em>{error}</em>}
      </div>
      {waiting ? (
        <img src={link.qr} alt="QR Code do WhatsApp do StudioFlow" />
      ) : (
        link.ready &&
        link.status !== "open" && (
          <button type="button" onClick={() => void start()} disabled={busy}>
            <QrCode size={16} /> {busy ? "Gerando…" : "Conectar"}
          </button>
        )
      )}
    </section>
  );
}
