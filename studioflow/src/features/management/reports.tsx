"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  CalendarCheck,
  DownloadSimple,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  MetricStrip,
  PageHeader,
} from "@/components/ui";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToast } from "@/components/toast";
import { money, statusLabels } from "@/lib/utils";
import { ManagementBoundary, FormError, downloadCsv } from "./shared";
import {
  financeSummary,
  periodFor,
  reais,
  validPeriod,
  type FinancePeriod,
  type FinancePreset,
} from "./finance-helpers";
import { PeriodControl } from "./period-control";
import { CommercialResults } from "./commercial-results";
export default function ReportsPage() {
  const { data } = useWorkspace(),
    { toast } = useToast();
  const [period, setPeriod] = useState<FinancePeriod>(() => periodFor("month")),
    [preset, setPreset] = useState<FinancePreset>("month");
  const summary = data ? financeSummary(data, period) : null;
  function download() {
    if (!summary) return;
    downloadCsv(
      [
        ["Relatório", period.from + " a " + period.to],
        ["Receita recebida", reais(summary.revenueCents).toFixed(2)],
        ["Concluídos", String(summary.completed.length)],
        ["Clientes atendidos", String(summary.clientsCount)],
        ["Comparecimento (%)", summary.attendance?.toFixed(1) || "Sem dados"],
        [],
        ["Serviço", "Atendimentos"],
        ...summary.services.map((item) => [
          item.service.name,
          String(item.count),
        ]),
        [],
        ["Profissional", "Atendimentos concluídos", "Recebimentos"],
        ...summary.professionals.map((item) => [
          item.professional.name,
          String(item.completedCount),
          reais(item.receivedCents).toFixed(2),
        ]),
      ],
      "relatorio-" + period.from + "-" + period.to + ".csv",
    );
    toast("Relatório do período exportado.");
  }
  return (
    <ManagementBoundary>
      <PageHeader
        title="Relatórios"
        description="Faturamento, serviços e profissionais por período."
        actions={
          <Button
            variant="secondary"
            onClick={download}
            disabled={!summary || !validPeriod(period)}
          >
            <DownloadSimple size={16} />
            Exportar CSV
          </Button>
        }
      />
      <PeriodControl
        period={period}
        preset={preset}
        onChange={(next, selected) => {
          setPeriod(next);
          setPreset(selected);
        }}
      />
      {!validPeriod(period) && (
        <FormError error="Selecione um período válido." />
      )}
      <CommercialResults period={period} />
      {summary && (
        <>
          <MetricStrip
            items={[
              {
                label: "Receita recebida",
                value: money(reais(summary.revenueCents)),
                detail: summary.payments.length + " pagamentos no período",
              },
              {
                label: "Atendimentos concluídos",
                value: summary.completed.length,
                detail: "Pela data do atendimento",
              },
              {
                label: "Clientes atendidos",
                value: summary.clientsCount,
                detail: summary.newClients + " novos cadastros",
              },
              {
                label: "Comparecimento",
                value:
                  summary.attendance === null
                    ? "—"
                    : summary.attendance.toFixed(0) + "%",
                detail: "Concluídos entre atendimentos e faltas",
              },
            ]}
          />
          <div className="management-two-columns">
            <Card className="management-panel">
              <div className="management-section-heading">
                <div>
                  <h2>Serviços mais realizados</h2>
                  <p>Atendimentos concluídos no período.</p>
                </div>
              </div>
              {summary.services.length ? (
                <ol className="management-ranking">
                  {summary.services.map((item, index) => (
                    <li key={item.service.id}>
                      <span className="management-rank-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>{item.service.name}</strong>
                        <small>{item.service.category}</small>
                      </div>
                      <b>
                        {item.count}
                        <small>
                          {item.count === 1 ? "atendimento" : "atendimentos"}
                        </small>
                      </b>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  title="Sem atendimentos concluídos"
                  description="O ranking será preenchido quando os serviços forem concluídos."
                />
              )}
            </Card>
            <Card className="management-panel">
              <div className="management-section-heading">
                <div>
                  <h2>Saúde da agenda</h2>
                  <p>{summary.appointments.length} agendamentos no período.</p>
                </div>
                <CalendarCheck size={20} weight="duotone" />
              </div>
              <div className="management-status-breakdown">
                {(
                  [
                    "completed",
                    "confirmed",
                    "in_progress",
                    "pending",
                    "cancelled",
                    "no_show",
                  ] as const
                ).map((status) => (
                  <div key={status}>
                    <span>
                      <i className={"management-status-dot " + status} />
                      {statusLabels[status]}
                    </span>
                    <strong>
                      {
                        summary.appointments.filter(
                          (item) => item.status === status,
                        ).length
                      }
                    </strong>
                  </div>
                ))}
              </div>
              <Link className="management-text-link" href="/dashboard/agenda">
                Abrir agenda
                <ArrowUpRight size={16} />
              </Link>
            </Card>
          </div>
          <Card className="management-panel">
            <div className="management-section-heading">
              <div>
                <h2>Resultado por profissional</h2>
                <p>
                  Ranking por recebimentos no período; atendimentos pela data da
                  agenda.
                </p>
              </div>
            </div>
            <div className="management-table-wrap">
              <table className="management-table">
                <thead>
                  <tr>
                    <th>Profissional</th>
                    <th>Concluídos</th>
                    <th>Recebimentos</th>
                    <th>Média recebida</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {summary.professionals.map((item, index) => (
                    <tr key={item.professional.id}>
                      <td>
                        <div className="management-person">
                          <span className="management-rank-number">
                            {index + 1}
                          </span>
                          <Avatar
                            name={item.professional.name}
                            src={item.professional.photo}
                            size={34}
                          />
                          <strong>{item.professional.name}</strong>
                        </div>
                      </td>
                      <td>{item.completedCount}</td>
                      <td>
                        <strong>{money(reais(item.receivedCents))}</strong>
                      </td>
                      <td>
                        {money(
                          reais(
                            item.paidCount
                              ? Math.round(item.receivedCents / item.paidCount)
                              : 0,
                          ),
                        )}
                      </td>
                      <td>
                        <Link
                          className="management-icon-button"
                          href={
                            "/dashboard/agenda?professional=" +
                            encodeURIComponent(item.professional.id)
                          }
                          aria-label={"Ver agenda de " + item.professional.name}
                        >
                          <ArrowUpRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </ManagementBoundary>
  );
}
