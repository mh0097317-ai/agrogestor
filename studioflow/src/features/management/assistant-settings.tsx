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
import { AssistantUsage } from "./assistant-usage";
import { TrainingCoach } from "./training-coach";

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
  const [scheduleEnabled, setScheduleEnabled] = useState(
    settings.assistantScheduleEnabled || false,
  );
  const [name, setName] = useState(settings.assistantName || "Recepção");
  const [instructions, setInstructions] = useState(
    settings.assistantInstructions || "",
  );
  const [limit, setLimit] = useState(
    String(settings.assistantDailyLimit || 300),
  );
  const [winback, setWinback] = useState(settings.winbackEnabled || false);
  const [winbackDays, setWinbackDays] = useState(
    String(settings.winbackDays || 35),
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
        assistantScheduleEnabled: scheduleEnabled,
        assistantName: name,
        assistantInstructions: instructions,
        assistantDailyLimit: Number(limit) || 300,
        winbackEnabled: winback,
        winbackDays: Math.min(120, Math.max(20, Number(winbackDays) || 35)),
      });
      toast(
        enabled ? "Atendente virtual ligada." : "Atendente virtual desligada.",
      );
    });
  }
  return (
    <div className="management-form payment-settings assistant-settings">
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
      {canManage && (
        <details className="assistant-usage-details">
          <summary>Consumo e limites de hoje</summary>
          <AssistantUsage limit={settings.assistantDailyLimit} />
        </details>
      )}
      {!store.aiReady && (
        <div className="management-info payment-warning-box">
          <Warning size={16} /> A recepcionista aguarda a configuração da sua
          credencial pela plataforma. A equipe pode continuar pelo botão
          “Acompanhar conversas”.
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
                  conversa. Quando ligada, volta a responder no próximo contato
                  do cliente.
                </small>
              </span>
            </label>
            <label className="assistant-toggle">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(event) => setScheduleEnabled(event.target.checked)}
              />
              <span>
                <strong>Responder somente durante o expediente</strong>
                <small>
                  A IA acompanha os dias e horários cadastrados em Horários e
                  regras ({settings.openStart} às {settings.openEnd}).
                </small>
              </span>
            </label>
            <label className="assistant-toggle">
              <input
                type="checkbox"
                checked={winback}
                onChange={(event) => setWinback(event.target.checked)}
              />
              <span>
                <strong>Chamar de volta quem sumiu</strong>
                <small>
                  Uma mensagem pelo WhatsApp para quem não volta há{" "}
                  <input
                    className="assistant-inline-number"
                    type="number"
                    min={20}
                    max={120}
                    value={winbackDays}
                    onChange={(event) => setWinbackDays(event.target.value)}
                    aria-label="Dias sem voltar"
                  />{" "}
                  dias, oferecendo o serviço de sempre. No máximo uma a cada 60
                  dias por cliente; quem responder PARAR não recebe mais.
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
            {canManage && (
              <TrainingCoach
                existing={instructions}
                onApply={setInstructions}
                disabled={!!busy}
              />
            )}
          </fieldset>
          <FormError error={error} />
          {canManage && (
            <div className="management-form-actions">
              <Button type="submit" disabled={!!busy}>
                {busy === "save" ? "Salvando…" : "Salvar treinamento"}
              </Button>
            </div>
          )}
        </form>
      </FormSection>
    </div>
  );
}
