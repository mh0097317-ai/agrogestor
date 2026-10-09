"use client";

import { useState, type FormEvent } from "react";

import {
  ArrowRight,
  CheckCircle,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { Button, FormSection } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { Store } from "@/types";
import { FormError, FormField } from "./shared";
import "./assistant-settings.css";

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data;
}

/**
 * Configurações → Recepcionista: the AI receptionist on the public page
 * chat and, when connected, on the business's own WhatsApp number.
 */
export function AssistantSettings({
  store,
  canManage,
  onSaved,
  onOpenWhatsApp,
}: {
  store: Store;
  canManage: boolean;
  onSaved: () => Promise<void>;
  onOpenWhatsApp: () => void;
}) {
  const { toast } = useToast();
  const settings = store.settings;
  const [enabled, setEnabled] = useState(settings.assistantEnabled);
  const [name, setName] = useState(settings.assistantName || "Recepção");
  const [instructions, setInstructions] = useState(
    settings.assistantInstructions || "",
  );
  const [limit, setLimit] = useState(
    String(settings.assistantDailyLimit || 300),
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const connections =
    (store.whatsappLink?.status === "open" ? 1 : 0) +
    (store.professionalWhatsAppLinks?.filter((link) => link.status === "open")
      .length || 0);
  const active = settings.assistantEnabled && store.aiReady && connections > 0;

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await task();
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy("");
    }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("save", async () => {
      await send("/api/workspace/assistant", "PATCH", {
        assistantEnabled: enabled,
        assistantName: name,
        assistantInstructions: instructions,
        assistantDailyLimit: Number(limit) || 300,
      });
      toast(
        enabled ? "Atendente virtual ligada." : "Atendente virtual desligada.",
      );
    });
  }
  return (
    <div className="management-form payment-settings">
      <div className="assistant-overview">
        <div className="assistant-overview-main">
          <span className="sheet-eyebrow">Atendimento no WhatsApp</span>
          <strong>
            {active
              ? "Pronto para atender"
              : !settings.assistantEnabled
                ? "Atendimento pausado"
                : !store.aiReady
                  ? "Configuração pendente"
                  : "Conecte um número"}
          </strong>
          <p>
            {active
              ? "Serviços, preços e agenda do seu estabelecimento. Você acompanha e pode assumir a conversa."
              : "Ative o atendimento, configure a credencial e conecte um WhatsApp para começar."}
          </p>
          <span className={`assistant-status ${active ? "is-active" : ""}`}>
            <i aria-hidden="true" />
            {active ? "Ativado" : "Aguardando ativação"}
          </span>
        </div>
        <div className="assistant-overview-connections">
          <span className="sheet-eyebrow">Seus números</span>
          <strong>
            {connections} {connections === 1 ? "conectado" : "conectados"}
          </strong>
          <p>
            O número da loja e o de cada profissional são gerenciados na aba
            WhatsApp.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={!!busy}
            onClick={onOpenWhatsApp}
          >
            Gerenciar WhatsApp <ArrowRight size={15} />
          </Button>
        </div>
      </div>
      {!store.aiReady && (
        <div className="management-info payment-warning-box">
          <Warning size={16} /> A recepcionista aguarda a configuração da sua
          credencial pela plataforma. As mensagens recebidas ficam em Conversas
          para a equipe continuar o atendimento.
        </div>
      )}
      <FormSection
        title="Como seu atendimento funciona"
        description="Defina a voz do estabelecimento e o limite diário de respostas. A conexão dos números e os avisos ficam na aba WhatsApp."
      >
        <form className="management-form" onSubmit={save}>
          <fieldset
            className="management-form settings-fields"
            disabled={!canManage || !!busy}
          >
            <label className="assistant-toggle">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span>
                <strong>
                  <CheckCircle size={16} /> Permitir atendimento automático
                </strong>
                <small>
                  Atende pelo WhatsApp conectado e agenda diretamente na
                  conversa. O chat do site acompanha a configuração do link
                  público.
                </small>
              </span>
            </label>
            <div className="management-form-grid">
              <FormField
                label="Nome do atendimento"
                hint="Identificação do atendimento, se o cliente perguntar. A conversa usa a voz da casa ou do profissional, sem repetir nomes."
              >
                <input
                  value={name}
                  maxLength={40}
                  onChange={(event) => setName(event.target.value)}
                />
              </FormField>
              <FormField
                label="Atendimentos por dia"
                hint="Teto diário de respostas da IA, para controlar o custo."
              >
                <input
                  type="number"
                  min={10}
                  max={5000}
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                />
              </FormField>
            </div>
            <FormField
              label="Instruções da casa (opcional)"
              hint="Ensine o jeito da casa: formal, normal ou descontraído. Inclua apenas regras e informações reais."
            >
              <textarea
                rows={4}
                maxLength={1500}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
              />
            </FormField>
          </fieldset>
          <FormError error={error} />
          {canManage && (
            <div className="management-form-actions">
              <Button type="submit" disabled={!!busy}>
                {busy === "save" ? "Salvando…" : "Salvar StudioFlow"}
              </Button>
            </div>
          )}
        </form>
      </FormSection>
    </div>
  );
}
