"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowSquareOut, Copy } from "@phosphor-icons/react/dist/ssr";
import { Button, FormSection } from "@/components/ui";
import { useToast } from "@/components/toast";
import { onlineBookingEnabled } from "@/lib/online-booking";
import type { Store } from "@/types";
import { FormError } from "./shared";

export function OnlineBookingNotice() {
  return (
    <div className="management-info" role="status">
      <div>
        <strong>Agendamento online desativado.</strong>
        <p>
          Os clientes devem entrar em contato para agendar. Sua agenda e os
          agendamentos internos continuam disponíveis.
        </p>
        <Link
          className="management-link-button"
          href="/dashboard/configuracoes?aba=onlineBooking"
        >
          Configurar agendamento online
        </Link>
      </div>
    </div>
  );
}

export function OnlineBookingSettings({
  store,
  canManage,
  onSaved,
}: {
  store: Store;
  canManage: boolean;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [saved, setSaved] = useState<{
    source: Store;
    enabled: boolean;
  } | null>(null);
  const enabled =
    saved?.source === store
      ? saved.enabled
      : onlineBookingEnabled(store.settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const url =
    typeof window === "undefined"
      ? `/${store.business.slug}`
      : `${window.location.origin}/${store.business.slug}`;

  async function toggle(next: boolean) {
    if (busy || !canManage) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspace/online-booking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlineBookingEnabled: next }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Não foi possível salvar.");
      setSaved({
        source: store,
        enabled: result.onlineBookingEnabled,
      });
      toast(
        next ? "Agendamento online ativado." : "Agendamento online desativado.",
      );
      await onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link público copiado.");
    } catch {
      toast("Abra a página e copie o endereço do navegador.");
    }
  }

  return (
    <div className="management-form" aria-busy={busy}>
      <FormSection
        title="Agendamento pelo link"
        description="Quando ativado, seus clientes poderão acessar sua página pública e escolher serviços, profissionais e horários disponíveis."
      >
        <label className="online-booking-toggle">
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            disabled={!canManage || busy}
            onChange={(event) => void toggle(event.target.checked)}
          />
          <span>Permitir que clientes façam agendamentos pelo link</span>
        </label>
        <p className="management-info" role="status">
          {busy
            ? "Salvando…"
            : enabled
              ? "Agendamento online ativado."
              : "Agendamento online desativado. Novos agendamentos pelo site estão bloqueados."}
        </p>
      </FormSection>
      {enabled ? (
        <FormSection title="Seu link público">
          <p className="online-booking-url">{url}</p>
          <div className="management-form-actions">
            <Button variant="secondary" onClick={() => void copyLink()}>
              <Copy size={15} /> Copiar link
            </Button>
            <Link
              href={`/${store.business.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="management-link-button"
            >
              <ArrowSquareOut size={15} /> Abrir página
            </Link>
          </div>
        </FormSection>
      ) : (
        <p className="management-info">
          Sua agenda, equipe, serviços e agendamentos manuais continuam
          funcionando. O endereço público e as configurações são preservados
          para quando você reativar.
        </p>
      )}
      <FormError error={error} />
    </div>
  );
}
