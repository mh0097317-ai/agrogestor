"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  LockKey,
  CheckCircle,
  ChatCircleDots,
  Receipt,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui";
import type { ManualInvoice, WhatsAppLink } from "@/types";
import type { AiVaultView } from "@/services/admin-vault";
import type { AudioVaultView } from "@/services/assistant/audio-vault";
import type { PlatformBusiness } from "@/services/platform";
import { hasModule } from "@/lib/modules";
import { useToast } from "@/components/toast";
import { notifyWorkspaceChange } from "@/lib/workspace-sync";

interface ClientConfiguration {
  settings: {
    assistantEnabled: boolean;
    assistantName: string;
    assistantInstructions: string;
    assistantDailyLimit: number;
  };
  vault: AiVaultView;
  audioVault: AudioVaultView;
  professionals: { id: string; name: string; active: boolean }[];
  shop: WhatsAppLink | null;
  links: (WhatsAppLink & { professionalId: string })[];
  invoices: ManualInvoice[];
}
async function request<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || "Não foi possível salvar.");
  return json as T;
}
const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (s: string) =>
  new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
const methods = {
  pix: "Pix",
  cash: "Dinheiro",
  card: "Cartão",
  transfer: "Transferência",
  other: "Outro",
};
export function ClientConfigurationPanel({
  item,
  demo,
  onSaved,
  initialTab = "assistant",
}: {
  item: PlatformBusiness;
  demo: boolean;
  onSaved: () => Promise<void>;
  initialTab?: string;
}) {
  const endpoint = `/api/admin/platform/${item.id}/config`;
  const { toast } = useToast();
  const [data, setData] = useState<ClientConfiguration | null>(null);
  const [tab, setTab] = useState(initialTab),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    void request<ClientConfiguration>(endpoint)
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [endpoint]);
  async function save(method: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      setData(await request<ClientConfiguration>(endpoint, method, body));
      notifyWorkspaceChange();
      await onSaved();
      toast("Configuração salva.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pf-block pf-client-config">
      <h3>Operação do estabelecimento</h3>
      <div
        className="pf-config-tabs"
        role="tablist"
        aria-label="Configuração do cliente"
      >
        {[
          { id: "assistant", label: "StudioFlow", icon: ChatCircleDots },
          { id: "vault", label: "Cofre de IA", icon: LockKey },
          { id: "billing", label: "Pagamentos", icon: Receipt },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <p className="pf-metric-note">Carregando configurações…</p>
      ) : (
        <>
          {tab === "assistant" && (
            <ReceptionistEditor
              key={item.id}
              data={data}
              disabled={busy}
              included={hasModule(item.modules, "recepcionista")}
              onSave={(body) => save("PATCH", body)}
            />
          )}
          {tab === "vault" && (
            <>
              <VaultEditor
                data={data.vault}
                disabled={busy || demo}
                onSave={(body) => save("PATCH", body)}
              />
              <AudioVaultEditor
                data={data.audioVault}
                disabled={busy || demo}
                onSave={(body) => save("PATCH", body)}
              />
            </>
          )}
          {tab === "billing" && (
            <PaymentEditor
              invoices={data.invoices}
              price={item.price}
              disabled={busy || demo}
              onSave={(body) => save("POST", body)}
            />
          )}
          {demo && tab !== "assistant" && (
            <p className="pf-metric-note">
              Chaves e pagamentos reais são cadastrados no admin publicado.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function AudioVaultEditor({
  data,
  disabled,
  onSave,
}: {
  data: AudioVaultView;
  disabled: boolean;
  onSave: (body: object) => Promise<void>;
}) {
  const [provider, setProvider] = useState("groq");
  const [key, setKey] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    await onSave({ kind: "audioKey", provider, key });
    setKey("");
  }
  return (
    <form className="pf-config-form" onSubmit={(event) => void save(event)}>
      <h3>Áudios do WhatsApp</h3>
      <p>
        {data?.configured
          ? `Transcrição configurada · ${data.provider}${data.hint ? ` · •••• ${data.hint}` : ""}`
          : "A transcrição ainda não está configurada para este cliente."}
      </p>
      <p>
        O StudioFlow interpreta o áudio, considera as seis mensagens anteriores
        e responde por texto quando o assunto é um serviço ou agendamento. Esta
        chave é separada da IA de conversa e fica criptografada no cofre deste
        estabelecimento.
      </p>
      <fieldset disabled={disabled}>
        <label>
          Serviço de transcrição
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="groq">Groq · Whisper Turbo</option>
            <option value="openai">OpenAI · Whisper</option>
          </select>
        </label>
        <label>
          Chave de transcrição
          <input
            type="password"
            autoComplete="new-password"
            value={key}
            minLength={20}
            required
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <small>
          O uso depende dos limites e créditos da sua conta no provedor. Salvar
          a chave não contrata um plano.
        </small>
        <Button type="submit" disabled={!key || disabled}>
          Validar e salvar áudio
        </Button>
      </fieldset>
    </form>
  );
}
function ReceptionistEditor({
  data,
  disabled,
  included,
  onSave,
}: {
  data: ClientConfiguration;
  disabled: boolean;
  included: boolean;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [draft, setDraft] = useState(data.settings);
  const update = (values: Partial<typeof draft>) =>
    setDraft((d) => ({ ...d, ...values }));
  function submit(event: FormEvent) {
    event.preventDefault();
    void onSave({ kind: "assistant", ...draft }).catch(() => undefined);
  }
  return (
    <form onSubmit={submit} className="pf-config-form">
      <fieldset disabled={disabled}>
        <label className="pf-config-toggle">
          <input
            type="checkbox"
            checked={draft.assistantEnabled}
            disabled={!included}
            onChange={(e) => update({ assistantEnabled: e.target.checked })}
          />
          <span>
            <strong>Atendimento automático ativo</strong>
            <small>
              Consulta a agenda real e conduz o cliente até a confirmação do
              horário.
            </small>
          </span>
        </label>
        {!included && (
          <p className="pf-readiness">
            O módulo StudioFlow está desabilitado neste plano.
          </p>
        )}
        <div className="pf-config-grid">
          <label>
            Nome no WhatsApp da loja
            <input
              value={draft.assistantName}
              required
              minLength={2}
              maxLength={40}
              onChange={(e) => update({ assistantName: e.target.value })}
            />
          </label>
          <label>
            Limite de respostas por dia
            <input
              type="number"
              min={10}
              max={5000}
              value={draft.assistantDailyLimit}
              onChange={(e) =>
                update({ assistantDailyLimit: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <label>
          Jeito de atender e regras da casa
          <textarea
            rows={4}
            maxLength={1500}
            value={draft.assistantInstructions}
            onChange={(e) => update({ assistantInstructions: e.target.value })}
            placeholder="Tom da conversa, informações e orientações autorizadas pelo estabelecimento."
          />
        </label>
        <div className="pf-identity-list">
          <div>
            <strong>{data.settings.assistantName || "Recepção"}</strong>
            <span>Número da loja · {data.shop?.phone || "não conectado"}</span>
            <small>
              {data.shop?.status === "open"
                ? "Conectado"
                : "Aguardando conexão do cliente"}
            </small>
          </div>
          {data.professionals
            .filter((p) => p.active)
            .map((p) => {
              const link = data.links.find((l) => l.professionalId === p.id);
              return (
                <div key={p.id}>
                  <strong>{p.name}</strong>
                  <span>
                    Número do profissional · {link?.phone || "não conectado"}
                  </span>
                  <small>
                    {link?.status === "open"
                      ? "Conectado · atende como canal de " + p.name
                      : "O profissional conecta por QR Code no painel dele"}
                  </small>
                </div>
              );
            })}
        </div>
        <p className="pf-metric-note">
          No número da loja, usa o nome da recepção. No número de cada
          profissional, usa a identidade do canal daquele profissional e
          consulta somente a agenda dele. Preços e horários vêm do cadastro;
          descontos exigem atendimento humano.
        </p>
        <Button type="submit" disabled={disabled}>
          Salvar StudioFlow
        </Button>
      </fieldset>
    </form>
  );
}
function VaultEditor({
  data,
  disabled,
  onSave,
}: {
  data: AiVaultView;
  disabled: boolean;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [provider, setProvider] = useState(data.provider || "anthropic"),
    [model, setModel] = useState(data.model || "claude-haiku-4-5"),
    [key, setKey] = useState(""),
    [remove, setRemove] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await onSave({ kind: "key", provider, model, key });
      setKey("");
    } catch {}
  }
  return (
    <form onSubmit={submit} className="pf-config-form" autoComplete="off">
      <fieldset disabled={disabled}>
        <div className="pf-vault-status">
          <LockKey size={26} />
          <div>
            <strong>
              {data.configured
                ? `Chave protegida · •••• ${data.hint}`
                : "Este cliente ainda não tem uma chave própria"}
            </strong>
            <p>
              {data.configured
                ? `${data.provider} · ${data.model}`
                : "Cadastre a credencial contratada para este estabelecimento."}
            </p>
          </div>
        </div>
        <div className="pf-config-grid">
          <label>
            Provedor
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setModel(
                  e.target.value === "openai" ? "gpt-4.1" : "claude-haiku-4-5",
                );
              }}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label>
            Modelo
            <input
              value={model}
              required
              maxLength={100}
              pattern="[a-zA-Z0-9._:\-]+"
              onChange={(e) => setModel(e.target.value)}
            />
          </label>
        </div>
        <label>
          {data.configured
            ? "Nova chave para substituir a atual"
            : "Chave da API"}
          <input
            type="password"
            value={key}
            required
            minLength={20}
            maxLength={1000}
            autoComplete="new-password"
            spellCheck={false}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <p className="pf-metric-note">
          A chave fica criptografada e não volta para o navegador. Apenas você
          pode trocar ou remover. A conta do provedor precisa ter saldo e acesso
          ao modelo escolhido.
        </p>
        <div className="pf-config-actions">
          {data.configured && (
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => void onSave({ kind: "model", model })}
            >
              Validar e trocar somente o modelo
            </Button>
          )}
          <Button type="submit" disabled={disabled || !key}>
            Validar e salvar chave
          </Button>
          {data.configured && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRemove(true)}
            >
              Remover chave
            </Button>
          )}
        </div>
        {remove && (
          <div className="pf-readiness">
            <p>
              Remover a chave própria deste estabelecimento? Se houver uma
              credencial padrão da plataforma, ela voltará a ser utilizada.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void onSave({ kind: "removeKey" })
                  .then(() => setRemove(false))
                  .catch(() => undefined)
              }
            >
              Confirmar remoção
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRemove(false)}
            >
              Manter chave
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
function PaymentEditor({
  invoices,
  price,
  disabled,
  onSave,
}: {
  invoices: ManualInvoice[];
  price: number | null;
  disabled: boolean;
  onSave: (body: unknown) => Promise<void>;
}) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const [value, setValue] = useState(price?.toFixed(2) || ""),
    [due, setDue] = useState(today),
    [method, setMethod] = useState<ManualInvoice["method"]>("pix"),
    [note, setNote] = useState(""),
    [days, setDays] = useState(30),
    [selected, setSelected] = useState<ManualInvoice | null>(null),
    [paidDate, setPaidDate] = useState(today),
    [renew, setRenew] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await onSave({
        action: "create",
        id: requestId,
        value: Number(value.replace(",", ".")),
        dueDate: due,
        method,
        note,
        days,
      });
      setRequestId(crypto.randomUUID());
      setNote("");
    } catch {}
  }
  return (
    <div className="pf-config-form">
      <p className="pf-metric-note">
        Registre as mensalidades cobradas por fora do Asaas. O pagamento só é
        contabilizado após sua confirmação.
      </p>
      <form onSubmit={create}>
        <fieldset disabled={disabled}>
          <div className="pf-config-grid">
            <label>
              Valor (R$)
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="100000"
                value={value}
                required
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <label>
              Vencimento
              <input
                type="date"
                value={due}
                required
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <label>
              Forma de pagamento
              <select
                value={method}
                onChange={(e) =>
                  setMethod(e.target.value as ManualInvoice["method"])
                }
              >
                {Object.entries(methods).map(([id, label]) => (
                  <option value={id} key={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dias contratados
              <input
                type="number"
                min={1}
                max={366}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            Observação
            <input
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <Button type="submit">Registrar mensalidade</Button>
        </fieldset>
      </form>
      {selected && (
        <div className="pf-receipt-confirm">
          <h4>Confirmar recebimento de {money(selected.value)}</h4>
          <label>
            Data em que recebeu
            <input
              type="date"
              required
              max={today}
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
            />
          </label>
          <label className="pf-config-toggle">
            <input
              type="checkbox"
              checked={renew}
              onChange={(e) => setRenew(e.target.checked)}
            />
            <span>
              Renovar o acesso por {selected.days} dias junto com o pagamento
            </span>
          </label>
          <div className="pf-config-actions">
            <Button
              disabled={disabled || !paidDate || paidDate > today}
              onClick={() =>
                void onSave({
                  action: "pay",
                  id: selected.id,
                  paidAt: `${paidDate}T00:00:00-03:00`,
                  renew,
                })
                  .then(() => setSelected(null))
                  .catch(() => undefined)
              }
            >
              <CheckCircle size={16} />
              Confirmar pagamento recebido
            </Button>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Voltar
            </Button>
          </div>
        </div>
      )}
      <ul className="pf-receipts">
        {invoices.map((i) => (
          <li key={i.id}>
            <div>
              <strong>
                {money(i.value)} ·{" "}
                {i.status === "paid"
                  ? "Recebido"
                  : i.status === "cancelled"
                    ? "Cancelado"
                    : "Em aberto"}
              </strong>
              <span>
                Vence {date(i.dueDate)} · {methods[i.method]}
                {i.paidAt ? ` · Pago ${date(i.paidAt)}` : ""}
              </span>
              {i.note && <small>{i.note}</small>}
            </div>
            {i.status === "pending" && (
              <div className="pf-config-actions">
                <button
                  disabled={disabled}
                  type="button"
                  className="pf-text-button"
                  onClick={() => {
                    setSelected(i);
                    setRenew(false);
                  }}
                >
                  Registrar recebimento
                </button>
                <button
                  disabled={disabled}
                  type="button"
                  className="pf-text-button"
                  onClick={() =>
                    void onSave({ action: "cancel", id: i.id }).catch(
                      () => undefined,
                    )
                  }
                >
                  Cancelar cobrança
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!invoices.length && (
        <p className="pf-metric-note">Nenhuma mensalidade manual registrada.</p>
      )}
    </div>
  );
}
export function EvolutionConfiguration({
  demo,
  onSaved,
  initiallyOpen = false,
}: {
  demo: boolean;
  onSaved: () => Promise<void>;
  initiallyOpen?: boolean;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [expanded, setExpanded] = useState(initiallyOpen);
  useEffect(() => {
    if (initiallyOpen) details.current?.scrollIntoView({ block: "start" });
  }, [initiallyOpen]);
  const [data, setData] = useState<{
      configured: boolean;
      url: string;
      hint: string;
      source: string;
    } | null>(null),
    [url, setUrl] = useState(""),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void request<typeof data>("/api/admin/evolution")
      .then((result) => {
        if (active) {
          setData(result);
          setUrl(result?.url || "");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setData(await request("/api/admin/evolution", "PUT", { url, key }));
      setKey("");
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível conectar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      ref={details}
      className="pf-integration pf-evolution"
      open={expanded}
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary>
        Servidor do WhatsApp
        <span>
          {data?.configured
            ? "Evolution API configurada"
            : "Configurar Evolution API"}
        </span>
      </summary>
      <form className="pf-config-form" onSubmit={save}>
        <p>
          A conexão dos clientes é feita por QR Code. Aqui você configura o
          servidor Evolution API v2 usado pela plataforma.
        </p>
        {!data?.configured && (
          <div className="pf-evolution-setup">
            <h4>Preparar o servidor</h4>
            <p>
              Comece pelo teste gratuito no Render, com servidor, banco e Redis
              no plano Free. O StudioFlow continua na Vercel e os dados dos
              estabelecimentos na Supabase.
            </p>
            <ol>
              <li>Instalar o pacote de teste com todos os recursos Free.</li>
              <li>Validar e salvar o endereço e a chave abaixo.</li>
              <li>Cadastrar a chave de IA no cofre de cada cliente.</li>
              <li>
                O estabelecimento conecta loja e profissionais por QR Code.
              </li>
            </ol>
            <a
              href="https://github.com/mh0097317-ai/studioflow/blob/main/ops/evolution/TESTE-GRATUITO.md"
              target="_blank"
              rel="noreferrer"
            >
              Abrir guia do teste gratuito no Render
            </a>
            <p>
              No teste, o servidor pode dormir e o banco expira em 30 dias.
              Créditos da IA são separados; conectar o QR não exige ativar a IA.
            </p>
          </div>
        )}
        <fieldset disabled={demo || busy || data?.source === "environment"}>
          <label>
            Endereço HTTPS da Evolution API
            <input
              type="url"
              value={url}
              required
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://whatsapp.suaempresa.com.br"
            />
          </label>
          <label>
            Chave global da Evolution API
            {data?.hint && <small>Atual: •••• {data.hint}</small>}
            <input
              type="password"
              value={key}
              required
              minLength={8}
              autoComplete="new-password"
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={!key || !url}>
            {busy ? "Verificando conexão…" : "Validar e salvar servidor"}
          </Button>
        </fieldset>
        {data?.source === "environment" && (
          <p className="pf-metric-note">
            A conexão atual é administrada pelas variáveis do ambiente na
            Vercel.
          </p>
        )}
        {demo && (
          <p className="pf-metric-note">
            Servidor real é configurado no admin publicado.
          </p>
        )}
        {error && (
          <p role="alert" className="pf-error">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}
