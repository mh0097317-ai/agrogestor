"use client";
import { useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { FormSection } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { dateLabel } from "@/lib/utils";
import type { Customer } from "@/types";

/**
 * Aniversário, consentimento de marketing e exportação dos dados (LGPD).
 * Consentimento começa desligado e só muda por ação explícita da equipe.
 */
export function CustomerPrivacy({
  customer,
  canEdit,
  canExport,
}: {
  customer: Customer;
  canEdit: boolean;
  canExport: boolean;
}) {
  const { toast } = useToast();
  const { refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(!!customer.marketingConsent);
  const [birth, setBirth] = useState(customer.birthDate || "");
  async function save(body: Record<string, unknown>, message: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/workspace/customers/${customer.id}/crm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      toast(message);
      await refresh();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível salvar.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormSection
      title="Aniversário e privacidade"
      description="Mensagens de marketing só para quem aceitou. Toda mudança fica registrada."
    >
      <div className="crm-privacy">
        <label>
          Data de nascimento
          <input
            type="date"
            value={birth}
            disabled={!canEdit || busy}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBirth(e.target.value)}
            onBlur={() => {
              if ((customer.birthDate || "") !== birth)
                void save({ birthDate: birth || null }, birth ? "Aniversário salvo." : "Aniversário removido.");
            }}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={consent}
            disabled={!canEdit || busy}
            onChange={async (e) => {
              const next = e.target.checked;
              if (
                await save(
                  { marketingConsent: next, consentSource: next ? "cliente_pediu" : "painel" },
                  next ? "Consentimento registrado." : "Cliente fora das mensagens de marketing.",
                )
              )
                setConsent(next);
            }}
          />{" "}
          Aceitou receber promoções e convites pelo WhatsApp
        </label>
        <p className="crm-privacy-note">
          {customer.consentUpdatedAt
            ? `Última mudança em ${dateLabel(customer.consentUpdatedAt, "dd/MM/yyyy 'às' HH:mm")}.`
            : "Sem registro de consentimento: não envie promoções."}{" "}
          Lembretes e confirmações de horário continuam normais.
        </p>
        {canExport && (
          <a
            className="btn btn-secondary"
            href={`/api/workspace/customers/${customer.id}/export`}
            download
          >
            <DownloadSimple size={16} />
            Exportar dados do cliente
          </a>
        )}
      </div>
    </FormSection>
  );
}
