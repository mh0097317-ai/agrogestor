"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button, Card, PageHeader } from "@/components/ui";
import { businessDay } from "@/lib/utils";
import {
  operationError,
  usageSummary,
  type OperationSnapshot,
} from "@/lib/operation-health";
import "./operation.css";

export default function OperationPage() {
  const {
    data,
    error: workspaceError,
    refresh: reloadWorkspace,
  } = useWorkspace();
  const [record, setSnapshot] = useState<OperationSnapshot | null>(null);
  const snapshot = record?.businessId === data?.business.id ? record : null;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const allowed = ["owner", "admin", "manager"].includes(
    data?.viewer?.role || "",
  );
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    try {
      const response = await fetch("/api/workspace/operation", {
        cache: "no-store",
        signal,
      });
      const body = await response.json();
      if (!response.ok)
        throw Error(body.error || "Não foi possível atualizar.");
      if (!signal?.aborted) {
        setSnapshot(body);
        setError("");
      }
    } catch (cause) {
      if (!signal?.aborted)
        setError(
          cause instanceof Error ? cause.message : "Falha ao atualizar.",
        );
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize the external operation snapshot
    void refresh(controller.signal);
    return () => controller.abort();
  }, [allowed, data?.business.id, refresh]);
  if (workspaceError)
    return (
      <Card>
        <h2>Não foi possível carregar seu espaço.</h2>
        <p>{workspaceError}</p>
        <Button onClick={() => void reloadWorkspace()}>Tentar novamente</Button>
      </Card>
    );
  if (!data) return <p>Carregando seu espaço…</p>;
  if (!allowed)
    return (
      <Card>Esta área está disponível para a gestão do estabelecimento.</Card>
    );
  const links = [
    data.whatsappLink,
    ...(data.professionalWhatsAppLinks || []),
  ].filter(Boolean);
  const connected =
    links.filter((link) => link?.status === "open").length +
    (data.whatsapp && data.whatsappLink?.status !== "open" ? 1 : 0);
  const problems = snapshot?.runs.filter((run) => run.state === "FAILED") || [];
  const notices =
    snapshot?.notifications.filter((row) => row.status !== "sent") || [];
  const usage =
    snapshot &&
    usageSummary(
      snapshot.usage,
      businessDay(),
      data.settings.assistantDailyLimit,
    );
  return (
    <div className="operation-page">
      <PageHeader
        title="Saúde da operação"
        description="Conexões, atendimento e sinais que precisam da sua atenção."
        actions={
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void refresh()}
          >
            {busy ? "Atualizando…" : "Atualizar"}
          </Button>
        }
      />
      {error && (
        <p role="alert" className="operation-warning">
          {error}{" "}
          {snapshot && "Abaixo estão os dados da última consulta concluída."}
        </p>
      )}
      <div className="operation-grid">
        <Card>
          <span className="operation-kicker">01 / Conexão</span>
          <h2>WhatsApp</h2>
          <strong>
            {connected}{" "}
            {connected === 1 ? "número conectado" : "números conectados"}
          </strong>
          <p>
            Estado registrado da loja e dos profissionais. Confira o envio no
            aparelho antes de repetir uma mensagem incerta.
          </p>
          <Link href="/dashboard/configuracoes?aba=whatsapp">
            Gerenciar conexões →
          </Link>
        </Card>
        <Card>
          <span className="operation-kicker">02 / Atendimento</span>
          <h2>Recepcionista</h2>
          <strong>
            {!data.settings.assistantEnabled
              ? "Pausada"
              : !data.aiReady
                ? "Credencial pendente"
                : connected
                  ? "Configurada para atender"
                  : "Conexão pendente"}
          </strong>
          <p>
            {snapshot?.configurationError
              ? "A configuração da ponte exige revisão pela plataforma."
              : snapshot?.n8nConfigured
                ? "Atendimento com ponte n8n. O fechamento da reserva é validado pelo StudioFlow."
                : "Motor de atendimento do StudioFlow."}{" "}
            Configuração não comprova saldo ou disponibilidade do provedor.
          </p>
          <Link href="/dashboard/configuracoes?aba=assistant">
            Ajustar atendimento →
          </Link>
        </Card>
        <Card>
          <span className="operation-kicker">03 / Automação</span>
          <h2>Avisos</h2>
          <strong>
            {snapshot
              ? `${notices.length} registros para conferir`
              : "Aguardando consulta"}
          </strong>
          <p>
            Últimos 20 avisos deste estabelecimento. “Aceito” significa
            aceitação pelo serviço de envio, não leitura pelo cliente.
          </p>
          <ul>
            {snapshot?.notifications.slice(0, 4).map((row, i) => (
              <li key={`${row.at}-${i}`}>
                <span>
                  {(
                    {
                      customer_booking: "Confirmação ao cliente",
                      professional_new: "Novo agendamento ao profissional",
                      customer_reminder: "Lembrete ao cliente",
                      reminder_24h: "Lembrete de 24h",
                      reminder_2h: "Lembrete de 2h",
                      daily_summary: "Resumo diário",
                      post_appointment: "Pós-atendimento",
                      no_show_followup: "Não comparecimento",
                      abandoned_conversation: "Conversa abandonada",
                      inactive_customer: "Cliente inativo",
                    } as Record<string, string>
                  )[row.kind] || "Aviso automático"}
                </span>
                <b>
                  {row.status === "sent"
                    ? "Aceito"
                    : row.status === "failed"
                      ? "Falhou"
                      : "Sem confirmação"}
                </b>
              </li>
            ))}
          </ul>
          {snapshot && !snapshot.notifications.length && (
            <p>
              Nenhum registro de aviso encontrado. Isso não comprova execução
              dos workflows.
            </p>
          )}
        </Card>
      </div>
      <Card>
        <span className="operation-kicker">Atenção / Últimos atendimentos</span>
        <h2>
          {problems.length
            ? `${problems.length} falhas para revisar`
            : snapshot
              ? "Nenhuma falha nos registros consultados"
              : "Consultando execução…"}
        </h2>
        <p>
          Amostra das últimas 20 execuções. Revise a conversa antes de reenviar
          ou confirmar uma reserva.
        </p>
        <ul>
          {problems.slice(0, 8).map((run, i) => (
            <li key={`${run.at}-${i}`}>
              <span>
                {operationError[run.errorCode || ""] ||
                  "Falha no atendimento; confira a conversa"}
              </span>
              <time>
                {new Date(run.at).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
              </time>
            </li>
          ))}
        </ul>
        <Link href="/dashboard/conversas">Abrir conversas →</Link>
      </Card>
      {usage && (
        <Card>
          <span className="operation-kicker">Consumo / Hoje</span>
          <h2>Seu limite diário</h2>
          <div className="operation-metrics">
            <div>
              <strong>{usage.turns}</strong>
              <span>turnos usados de {data.settings.assistantDailyLimit}</span>
            </div>
            <div>
              <strong>{usage.remaining}</strong>
              <span>turnos restantes</span>
            </div>
            <div>
              <strong>{usage.todayTokens.toLocaleString("pt-BR")}</strong>
              <span>tokens internos registrados hoje</span>
            </div>
          </div>
          <meter
            aria-label="Uso do limite diário"
            min={0}
            max={data.settings.assistantDailyLimit}
            value={Math.min(usage.turns, data.settings.assistantDailyLimit)}
          />
          <p>
            {usage.alert === "blocked"
              ? "Limite atingido: novas tentativas ficam com a equipe."
              : usage.alert === "near"
                ? "Você já usou pelo menos 80% do limite. Revise a quota e acompanhe as conversas."
                : "O limite de turnos ajuda a controlar chamadas, mas não é um teto de gasto em reais."}
          </p>
          <p>
            Tokens registrados nos últimos 30 dias:{" "}
            {usage.periodTokens.toLocaleString("pt-BR")}. O consumo externo do
            n8n e de áudio deve ser acompanhado nos respectivos provedores.
          </p>
          <Link href="/dashboard/configuracoes?aba=assistant">
            Ajustar limite diário →
          </Link>
        </Card>
      )}
      <p className="operation-footnote">
        {snapshot
          ? `Última consulta: ${new Date(snapshot.checkedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}${snapshot.demo ? " · Demonstração; sem dados reais de consumo" : ""}`
          : "Os dados de execução ainda não foram consultados."}
      </p>
    </div>
  );
}
