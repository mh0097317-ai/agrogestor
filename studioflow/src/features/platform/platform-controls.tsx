"use client";
import { useState } from "react";
import { hasModule } from "@/lib/modules";
import type { ChannelEvent, PlatformBusiness } from "@/services/platform";

export interface IntegrationStatus {
  evolution: boolean;
  ai: boolean;
  model: string;
}
export function PlatformControls({
  item,
  integrations,
  onAct,
}: {
  item: PlatformBusiness;
  integrations: IntegrationStatus | null;
  onAct: (
    body: Record<string, unknown>,
    message: string,
    method?: string,
  ) => Promise<void>;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function change(channel: string, enabled: boolean) {
    setBusy(channel);
    setError("");
    try {
      await onAct(
        { businessId: item.id, channel, enabled },
        channel === "public_link"
          ? `Link público ${enabled ? "ativado" : "desativado"}.`
          : `StudioFlow ${enabled ? "ativada" : "desativada"}.`,
        "PATCH",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    } finally {
      setBusy("");
    }
  }
  const included = hasModule(item.modules, "recepcionista");
  return (
    <section className="pf-block pf-channel-controls">
      <h3>Canais de agendamento</h3>
      <label className="pf-toggle">
        <input
          type="checkbox"
          role="switch"
          checked={item.onlineBookingEnabled}
          disabled={!!busy}
          onChange={(e) => void change("public_link", e.target.checked)}
        />
        <span>
          <strong>Agendamento pelo link público</strong>
          <small>
            {item.onlineBookingEnabled
              ? "Clientes podem escolher serviços e horários pelo site."
              : "Link desativado. A agenda e os agendamentos manuais continuam disponíveis."}
          </small>
        </span>
        <b>
          {busy === "public_link"
            ? "Salvando…"
            : item.onlineBookingEnabled
              ? "Ativado"
              : "Desativado"}
        </b>
      </label>
      <label className="pf-toggle">
        <input
          type="checkbox"
          role="switch"
          checked={item.assistantEnabled}
          disabled={!!busy || (!included && !item.assistantEnabled)}
          onChange={(e) => void change("receptionist", e.target.checked)}
        />
        <span>
          <strong>StudioFlow no WhatsApp</strong>
          <small>
            {included
              ? "Conduz a conversa e marca horários reais pelo WhatsApp conectado."
              : "Libere o módulo StudioFlow no plano para ativar."}
          </small>
        </span>
        <b>
          {busy === "receptionist"
            ? "Salvando…"
            : item.assistantEnabled
              ? "Ativada"
              : "Desativada"}
        </b>
      </label>
      <p className="pf-muted">
        WhatsApp do estabelecimento:{" "}
        <b>
          {item.whatsappStatus === "open"
            ? "conectado"
            : item.whatsappStatus === "connecting"
              ? "aguardando leitura do QR Code"
              : "desconectado"}
        </b>
        . O dono conecta em Configurações → StudioFlow.
      </p>
      {item.assistantEnabled &&
        (!(item.aiConfigured || integrations?.ai) ||
          !integrations?.evolution ||
          item.whatsappStatus !== "open") && (
          <p className="pf-readiness" role="status">
            StudioFlow ativada, aguardando{" "}
            {[
              !integrations?.evolution && "configuração da Evolution API",
              !(item.aiConfigured || integrations?.ai) &&
                "chave de IA no cofre",
              item.whatsappStatus !== "open" && "conexão do WhatsApp da loja",
            ]
              .filter(Boolean)
              .join(" e ")}{" "}
            para atender pelo WhatsApp.
          </p>
        )}
      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function PlatformMetrics({
  item,
  periodLabel,
}: {
  item: PlatformBusiness;
  periodLabel: string;
}) {
  const a = item.activity;
  const cells = [
    ["Agendamentos criados", a.appointments],
    ["Clientes que agendaram", a.bookingCustomers],
    ["Agendamentos pela IA", a.assistantBookings],
    ["Pela IA no WhatsApp", a.whatsappBookings],
    ["Clientes que agendaram pela IA", a.assistantCustomers],
    ["Aguardando humano agora", a.waitingHuman],
    ["Conversas com clientes", a.conversations],
    ["Atendimentos concluídos", a.completed],
    ["Recebido pelo estabelecimento", money(a.received)],
    ["Recebido de agendamentos da IA", money(a.assistantReceived)],
    ["Vendas de produtos recebidas", money(a.productReceived)],
    ["Valor dos agendamentos criados", money(a.bookedValue)],
    ["Respostas da IA", a.turns],
    [
      "Tokens de entrada / saída",
      `${a.inputTokens.toLocaleString("pt-BR")} / ${a.outputTokens.toLocaleString("pt-BR")}`,
    ],
  ];
  return (
    <section className="pf-block">
      <h3>Resultados · {periodLabel}</h3>
      <div className="pf-metrics">
        {cells.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <p className="pf-muted">
        Origens: {a.publicBookings} pelo link · {a.manualBookings} manuais ·{" "}
        {a.assistantBookings} pela IA · {a.legacyBookings} sem origem
        registrada. Cancelados no período: {a.cancelled}. Aguardando humano
        agora: {a.waitingHuman}.
      </p>
      <p className="pf-metric-note">
        Agendamentos e clientes seguem a data de criação; concluídos, a data do
        atendimento; recebimentos, a data do pagamento. Conversas contam quem
        enviou mensagem no período. Valores agendados ainda podem estar em
        aberto. Lucro líquido não apurado: custos operacionais não estão
        registrados.
      </p>
    </section>
  );
}

export function ChannelHistory({ events }: { events: ChannelEvent[] }) {
  if (!events.length) return null;
  return (
    <section className="pf-history">
      <h3>Histórico dos canais</h3>
      <ol>
        {events.map((event) => (
          <li key={event.id}>
            <span>
              {event.channel === "public_link" ? "Link público" : "StudioFlow"}:{" "}
              {event.enabled ? "ativado" : "desativado"}
            </span>
            <small>
              {new Intl.DateTimeFormat("pt-BR", {
                timeZone: "America/Sao_Paulo",
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(event.createdAt))}
            </small>
          </li>
        ))}
      </ol>
    </section>
  );
}
