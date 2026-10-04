"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  Copy,
  LockSimple,
  Microphone,
  Robot,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { InstagramIcon, WhatsAppIcon } from "@/components/brand-icons";
import { Button, FormSection } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { Store } from "@/types";
import { FormError, FormField } from "./shared";

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
}: {
  store: Store;
  canManage: boolean;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const settings = store.settings;
  const [enabled, setEnabled] = useState(settings.assistantEnabled);
  const [name, setName] = useState(settings.assistantName || "Recepção");
  const [instructions, setInstructions] = useState(settings.assistantInstructions || "");
  const [limit, setLimit] = useState(String(settings.assistantDailyLimit || 300));
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [token, setToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [webhook, setWebhook] = useState<{ webhookUrl: string; verifyToken: string } | null>(null);
  const [igToken, setIgToken] = useState("");
  const [igSecret, setIgSecret] = useState("");
  const [igWebhook, setIgWebhook] = useState<{ webhookUrl: string; verifyToken: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

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
      toast(enabled ? "Atendente virtual ligada." : "Atendente virtual desligada.");
    });
  }
  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("whatsapp", async () => {
      const result = await send("/api/workspace/assistant/whatsapp", "POST", {
        phoneNumberId,
        token,
        appSecret,
      });
      setToken("");
      setAppSecret("");
      setWebhook(result);
      toast(`WhatsApp ${result.displayPhone || ""} conectado.`);
    });
  }
  function connectInstagram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("instagram", async () => {
      const result = await send("/api/workspace/assistant/instagram", "POST", {
        token: igToken,
        appSecret: igSecret,
      });
      setIgToken("");
      setIgSecret("");
      setIgWebhook(result);
      toast(`Instagram @${result.username || ""} conectado.`);
    });
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copiado.");
    } catch {
      toast("Selecione o texto e copie.");
    }
  }

  return (
    <div className="management-form payment-settings">
      {!store.aiReady && (
        <div className="management-info payment-warning-box">
          <Warning size={16} /> O servidor ainda não tem a chave da IA
          (ANTHROPIC_API_KEY). Enquanto isso, as mensagens chegam em Conversas
          e a equipe responde.
        </div>
      )}
      <FormSection
        title="Atendente virtual"
        description="Responde no chat da sua página e no WhatsApp: tira dúvidas de preço e horário, mostra horários livres e marca sozinha. Você acompanha tudo em Conversas e assume quando quiser."
      >
        <form className="management-form" onSubmit={save}>
          <fieldset className="management-form settings-fields" disabled={!canManage || !!busy}>
            <label className="assistant-toggle">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span>
                <strong>
                  <Robot size={16} /> Atendente ligada
                </strong>
                <small>Aparece o botão “Tirar dúvidas e agendar” na sua página.</small>
              </span>
            </label>
            <div className="management-form-grid">
              <FormField label="Nome da atendente" hint="Como ela se apresenta ao cliente.">
                <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
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
              hint="Ex.: Não atendemos crianças menores de 5 anos. Aceitamos Pix e cartão. Estacionamento em frente."
            >
              <textarea
                rows={4}
                maxLength={1500}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
              />
            </FormField>
          </fieldset>
          {canManage && (
            <div className="management-form-actions">
              <Button type="submit" disabled={!!busy}>
                {busy === "save" ? "Salvando…" : "Salvar atendente"}
              </Button>
            </div>
          )}
        </form>
      </FormSection>
      <FormSection
        title="WhatsApp oficial"
        description="Conecte o número de WhatsApp Business da casa pela API oficial da Meta. A atendente responde por ele e a equipe também, pelo painel."
      >
        {store.whatsapp ? (
          <div className="payment-account">
            <CheckCircle weight="fill" size={22} />
            <div>
              <strong>
                <WhatsAppIcon size={15} /> {store.whatsapp.displayPhone || "Número conectado"}
              </strong>
              <span>ID do número {store.whatsapp.phoneNumberId}</span>
            </div>
            {canManage && (
              <Button
                type="button"
                variant="secondary"
                disabled={!!busy}
                onClick={() =>
                  void run("off", async () => {
                    await send("/api/workspace/assistant/whatsapp", "DELETE");
                    setWebhook(null);
                    toast("WhatsApp desconectado.");
                  })
                }
              >
                Desconectar
              </Button>
            )}
          </div>
        ) : store.mode === "demo" ? (
          <p className="payment-copy">
            Na demonstração o WhatsApp oficial não é conectado: use o chat da página para
            testar a atendente.
          </p>
        ) : (
          <form className="management-form" onSubmit={connect}>
            <ol className="payment-steps">
              <li>
                Em{" "}
                <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
                  developers.facebook.com <ArrowSquareOut size={12} />
                </a>
                , crie um app do tipo Business e adicione o WhatsApp.
              </li>
              <li>Cadastre o número da casa e gere um token de acesso permanente (usuário do sistema).</li>
              <li>Copie o ID do número, o token e a chave secreta do app (Configurações do app → Básico).</li>
            </ol>
            <div className="management-form-grid">
              <FormField label="ID do número de telefone">
                <input
                  value={phoneNumberId}
                  inputMode="numeric"
                  onChange={(event) => setPhoneNumberId(event.target.value)}
                  disabled={!canManage}
                  required
                />
              </FormField>
              <FormField label="Chave secreta do app">
                <input
                  type="password"
                  value={appSecret}
                  autoComplete="off"
                  onChange={(event) => setAppSecret(event.target.value)}
                  disabled={!canManage}
                  required
                />
              </FormField>
            </div>
            <FormField label="Token de acesso" hint="Fica guardado cifrado no servidor.">
              <input
                type="password"
                value={token}
                autoComplete="off"
                onChange={(event) => setToken(event.target.value)}
                disabled={!canManage}
                required
              />
            </FormField>
            {canManage && (
              <div className="management-form-actions">
                <Button type="submit" disabled={!!busy}>
                  <LockSimple size={16} />
                  {busy === "whatsapp" ? "Conferindo com a Meta…" : "Conectar WhatsApp"}
                </Button>
              </div>
            )}
          </form>
        )}
        {webhook && (
          <div className="assistant-webhook">
            <strong>Último passo, na Meta: WhatsApp → Configuração → Webhook</strong>
            <span>URL de retorno</span>
            <button type="button" onClick={() => void copy(webhook.webhookUrl)}>
              <code>{webhook.webhookUrl}</code> <Copy size={14} />
            </button>
            <span>Token de verificação (aparece só agora)</span>
            <button type="button" onClick={() => void copy(webhook.verifyToken)}>
              <code>{webhook.verifyToken}</code> <Copy size={14} />
            </button>
            <small>Depois de verificar, assine o campo “messages”.</small>
          </div>
        )}
        <FormError error={error} />
      </FormSection>
      <FormSection
        title="Instagram Direct"
        description="A atendente também responde quem chama no Direct da casa e pede o WhatsApp para marcar. A equipe responde pelo painel, dentro de 24 horas da última mensagem do cliente."
      >
        {store.instagram ? (
          <div className="payment-account">
            <CheckCircle weight="fill" size={22} />
            <div>
              <strong>
                <InstagramIcon size={15} /> @{store.instagram.username || "conta conectada"}
              </strong>
              <span>ID da conta {store.instagram.igUserId}</span>
            </div>
            {canManage && (
              <Button
                type="button"
                variant="secondary"
                disabled={!!busy}
                onClick={() =>
                  void run("ig-off", async () => {
                    await send("/api/workspace/assistant/instagram", "DELETE");
                    setIgWebhook(null);
                    toast("Instagram desconectado.");
                  })
                }
              >
                Desconectar
              </Button>
            )}
          </div>
        ) : store.mode === "demo" ? (
          <p className="payment-copy">
            Na demonstração o Instagram não é conectado: use o chat da página para testar a
            atendente.
          </p>
        ) : (
          <form className="management-form" onSubmit={connectInstagram}>
            <ol className="payment-steps">
              <li>
                A conta do Instagram da casa precisa ser profissional (Empresa ou Criador de
                conteúdo).
              </li>
              <li>
                No mesmo app da Meta, adicione o produto Instagram e gere o token de acesso da
                conta (API do Instagram com login do Instagram).
              </li>
              <li>Cole o token e a chave secreta do app (Configurações do app → Básico).</li>
            </ol>
            <div className="management-form-grid">
              <FormField label="Token de acesso do Instagram" hint="Fica guardado cifrado no servidor.">
                <input
                  type="password"
                  value={igToken}
                  autoComplete="off"
                  onChange={(event) => setIgToken(event.target.value)}
                  disabled={!canManage}
                  required
                />
              </FormField>
              <FormField label="Chave secreta do app">
                <input
                  type="password"
                  value={igSecret}
                  autoComplete="off"
                  onChange={(event) => setIgSecret(event.target.value)}
                  disabled={!canManage}
                  required
                />
              </FormField>
            </div>
            {canManage && (
              <div className="management-form-actions">
                <Button type="submit" disabled={!!busy}>
                  <LockSimple size={16} />
                  {busy === "instagram" ? "Conferindo com a Meta…" : "Conectar Instagram"}
                </Button>
              </div>
            )}
          </form>
        )}
        {igWebhook && (
          <div className="assistant-webhook">
            <strong>Último passo, na Meta: Instagram → Webhooks</strong>
            <span>URL de retorno</span>
            <button type="button" onClick={() => void copy(igWebhook.webhookUrl)}>
              <code>{igWebhook.webhookUrl}</code> <Copy size={14} />
            </button>
            <span>Token de verificação (aparece só agora)</span>
            <button type="button" onClick={() => void copy(igWebhook.verifyToken)}>
              <code>{igWebhook.verifyToken}</code> <Copy size={14} />
            </button>
            <small>Depois de verificar, assine o campo “messages”.</small>
          </div>
        )}
      </FormSection>
      <div className={`management-info ${store.transcriptionReady ? "" : "payment-warning-box"}`}>
        <Microphone size={16} />
        {store.transcriptionReady
          ? "Áudios do WhatsApp e do Instagram viram texto: a atendente entende e responde, e a equipe lê a transcrição em Conversas."
          : "Áudios ainda não são transcritos: a atendente pede para o cliente escrever. Para ligar, defina TRANSCRIBE_API_KEY no servidor."}
      </div>
      <div className="management-info">
        <Robot size={16} /> A atendente usa a IA Claude, da Anthropic. Ela só marca por
        dentro das regras da sua agenda e nunca mostra dados de outros clientes. Cancelar
        e remarcar continuam pelo link do comprovante ou com a equipe.
      </div>
    </div>
  );
}
