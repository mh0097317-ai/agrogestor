"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  LockSimple,
  Plugs,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { Button, FormSection } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { DepositMode, Store } from "@/types";
import { depositFor, minimumCharge } from "@/lib/payments";
import { money } from "@/lib/utils";
import { FormError, FormField } from "./shared";

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || "Não foi possível concluir.");
  return data;
}

const environmentLabel = {
  sandbox: "Ambiente de testes (sandbox)",
  production: "Conta real",
  demo: "Pagamento simulado (demonstração)",
};

/**
 * Configurações → Pagamentos: the owner connects their own Asaas account
 * (money lands with them, never with StudioFlow) and sets the deposit.
 */
export function PaymentSettings({
  store,
  canManage,
  onSaved,
}: {
  store: Store;
  canManage: boolean;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const account = store.paymentAccount;
  const demo = store.mode === "demo";
  const [environment, setEnvironment] = useState<"sandbox" | "production">(
    "production",
  );
  const [apiKey, setApiKey] = useState("");
  const [mode, setMode] = useState<DepositMode>(store.settings.depositMode);
  const [value, setValue] = useState(String(store.settings.depositValue || ""));
  const [hold, setHold] = useState(String(store.settings.depositHold));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const examplePrice =
    store.services.find((service) => service.active)?.price || 50;
  const example = depositFor(
    { depositMode: mode, depositValue: Number(value) || 0 },
    examplePrice,
  );

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

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("connect", async () => {
      const result = await send("/api/workspace/payments", "POST", {
        environment,
        apiKey: demo ? "demonstracao-sem-chave-real-0000" : apiKey,
      });
      setApiKey("");
      setWarning(result.warning || "");
      toast("Conta de pagamentos conectada.");
    });
  }

  function disconnect() {
    void run("disconnect", async () => {
      await send("/api/workspace/payments", "DELETE");
      setWarning("");
      toast("Conta desconectada. O sinal e o clube ficam pausados.");
    });
  }

  function saveDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("deposit", async () => {
      await send("/api/workspace/payments", "PATCH", {
        depositMode: mode,
        depositValue: mode === "off" ? 0 : Number(value) || 0,
        depositHold: Number(hold) || 15,
      });
      toast(mode === "off" ? "Sinal desligado." : "Sinal salvo.");
    });
  }

  return (
    <div className="management-form payment-settings">
      <FormSection
        title="Conta de recebimento"
        description="Conecte sua conta Asaas. O dinheiro cai direto nela: o StudioFlow não recebe, não segura e não repassa valores."
      >
        {account ? (
          <div className="payment-account">
            <CheckCircle weight="fill" size={22} />
            <div>
              <strong>Asaas conectado</strong>
              <span>
                {environmentLabel[account.environment]}
                {account.environment !== "demo" &&
                  ` · chave terminada em ${account.hint}`}
              </span>
              {!account.webhook && (
                <span className="payment-warning">
                  <Warning size={14} /> Avisos automáticos desligados. Os
                  pagamentos são conferidos quando o cliente abre o
                  comprovante.
                </span>
              )}
            </div>
            {canManage && (
              <Button
                type="button"
                variant="secondary"
                onClick={disconnect}
                disabled={!!busy}
              >
                {busy === "disconnect" ? "Desconectando…" : "Desconectar"}
              </Button>
            )}
          </div>
        ) : demo ? (
          <form className="management-form" onSubmit={connect}>
            <p className="payment-copy">
              Na demonstração não há conta real: o Pix e as assinaturas são
              simulados e nenhum valor é cobrado.
            </p>
            <div className="management-form-actions">
              <Button type="submit" disabled={!canManage || !!busy}>
                <Plugs size={16} />
                {busy === "connect"
                  ? "Ativando…"
                  : "Ativar pagamento simulado"}
              </Button>
            </div>
          </form>
        ) : (
          <form className="management-form" onSubmit={connect}>
            <ol className="payment-steps">
              <li>
                Crie ou acesse sua conta em{" "}
                <a href="https://www.asaas.com" target="_blank" rel="noreferrer">
                  asaas.com <ArrowSquareOut size={12} />
                </a>
                .
              </li>
              <li>
                Vá em Integrações → Chaves de API e gere uma chave nova.
              </li>
              <li>Cole a chave aqui. Ela é guardada cifrada no servidor.</li>
            </ol>
            <div className="management-form-grid">
              <FormField label="Ambiente">
                <select
                  value={environment}
                  onChange={(event) =>
                    setEnvironment(event.target.value as typeof environment)
                  }
                  disabled={!canManage}
                >
                  <option value="production">Conta real</option>
                  <option value="sandbox">Testes (sandbox)</option>
                </select>
              </FormField>
              <FormField
                label="Chave de API"
                hint="Começa com $aact_. Não compartilhe com ninguém."
              >
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="$aact_..."
                  required
                  minLength={20}
                  disabled={!canManage}
                />
              </FormField>
            </div>
            <div className="management-form-actions">
              <Button type="submit" disabled={!canManage || !!busy}>
                <LockSimple size={16} />
                {busy === "connect" ? "Conferindo a chave…" : "Conectar Asaas"}
              </Button>
            </div>
          </form>
        )}
        {warning && (
          <div className="management-info payment-warning-box">
            <Warning size={16} /> {warning}
          </div>
        )}
      </FormSection>
      <FormSection
        title="Sinal no agendamento"
        description="O cliente paga uma parte no Pix para garantir o horário. Sem pagamento no prazo, o horário volta a ficar livre. O sinal é descontado do valor no dia."
      >
        <form className="management-form" onSubmit={saveDeposit}>
          <fieldset
            className="management-form settings-fields"
            disabled={!canManage || !!busy}
          >
            <div className="payment-modes" role="radiogroup" aria-label="Sinal">
              {(
                [
                  ["off", "Sem sinal"],
                  ["fixed", "Valor fixo"],
                  ["percent", "Percentual"],
                ] as const
              ).map(([id, label]) => (
                <label key={id} className={mode === id ? "is-on" : ""}>
                  <input
                    type="radio"
                    name="deposit-mode"
                    checked={mode === id}
                    onChange={() => setMode(id)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {mode !== "off" && (
              <div className="management-form-grid">
                <FormField
                  label={mode === "fixed" ? "Valor do sinal (R$)" : "Percentual do serviço (%)"}
                  hint={
                    mode === "fixed"
                      ? `Mínimo de R$ ${minimumCharge},00. Nunca passa do preço do serviço.`
                      : `Abaixo de R$ ${minimumCharge},00 o sinal fica em R$ ${minimumCharge},00.`
                  }
                >
                  <input
                    type="number"
                    inputMode="decimal"
                    min={mode === "fixed" ? minimumCharge : 1}
                    max={mode === "fixed" ? 100000 : 100}
                    step={mode === "fixed" ? 0.01 : 1}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    required
                  />
                </FormField>
                <FormField
                  label="Prazo para pagar (minutos)"
                  hint="Tempo que o horário fica guardado esperando o Pix."
                >
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={hold}
                    onChange={(event) => setHold(event.target.value)}
                    required
                  />
                </FormField>
              </div>
            )}
            {mode !== "off" && example > 0 && (
              <p className="payment-copy">
                Exemplo: num serviço de {money(examplePrice)}, o cliente paga{" "}
                <b>{money(example)}</b> agora e {money(examplePrice - example)}{" "}
                no dia.
              </p>
            )}
            {mode !== "off" && !account && (
              <p className="payment-warning">
                <Warning size={14} /> O sinal só é cobrado depois que a conta
                Asaas estiver conectada.
              </p>
            )}
          </fieldset>
          <FormError error={error} />
          {canManage && (
            <div className="management-form-actions">
              <Button type="submit" disabled={!!busy}>
                {busy === "deposit" ? "Salvando…" : "Salvar sinal"}
              </Button>
            </div>
          )}
        </form>
      </FormSection>
      <div className="management-info">
        <LockSimple size={16} /> O CPF do cliente vai direto para o Asaas
        emitir o Pix e não é guardado no StudioFlow. Devoluções são feitas por
        você, no painel do Asaas.
      </div>
    </div>
  );
}
