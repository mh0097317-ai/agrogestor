"use client";
import { useEffect, useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { Button, Card, MetricStrip } from "@/components/ui";
import { useWorkspace } from "@/hooks/use-workspace";
import { money } from "@/lib/utils";
import type { CommercialReport } from "@/lib/commercial-impact";
import { validPeriod, type FinancePeriod } from "./finance-helpers";
import { downloadCsv } from "./shared";
import "./commercial-results.css";

export function CommercialResults({ period }: { period: FinancePeriod }) {
  const { data } = useWorkspace();
  const [report, setReport] = useState<CommercialReport | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const allowed = ["owner", "admin", "manager"].includes(
    data?.viewer?.role || "",
  );
  const businessId = data?.business.id;
  const { from, to } = period;
  useEffect(() => {
    if (!allowed || !validPeriod({ from, to })) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    fetch(
      `/api/workspace/commercial?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw Error(body.error || "Não foi possível conferir os resultados.");
        if (active) {
          setReport(body);
          setError("");
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error && cause.name !== "AbortError"
              ? cause.message
              : "A consulta demorou mais que o esperado. Tente novamente.",
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [allowed, businessId, from, to, attempt]);
  if (!allowed || !validPeriod(period)) return null;
  // Never render facts for another selected period while an update is pending.
  const current =
    report?.businessId === businessId &&
    report?.from === from &&
    report?.to === to
      ? report
      : null;
  function download() {
    if (!current) return;
    downloadCsv(
      [
        ["Resultados comerciais", from + " a " + to],
        [
          "Base",
          current.demo ? "Demonstração" : "Registros do estabelecimento",
        ],
        [
          "Critérios",
          "Criados pela criação; concluídos/cancelados/faltas pela data agendada e status atual; recebidos pela data do pagamento",
        ],
        [
          "Canal",
          "Reservas criadas",
          "Concluídos",
          "Cancelados",
          "Faltas",
          "Recebido (R$)",
        ],
        ...current.channels.map((c) => [
          c.label,
          String(c.created),
          String(c.completed),
          String(c.cancelled),
          String(c.noShow),
          (c.receivedCents / 100).toFixed(2),
        ]),
      ],
      `resultado-comercial-${from}-${to}.csv`,
    );
  }
  return (
    <Card className="commercial-results">
      <div className="management-section-heading">
        <div>
          <span className="commercial-eyebrow">
            Origem das reservas / Resultado observado
          </span>
          <h2>O que seu atendimento trouxe.</h2>
          <p>
            Reservas e recebimentos com origem registrada pelo StudioFlow
            {current?.demo ? " · Demonstração" : ""}.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={!current || !!error}
          onClick={download}
        >
          <DownloadSimple size={16} />
          Exportar por canal
        </Button>
      </div>
      {error && (
        <div role="alert" className="commercial-error">
          <p>
            {error}{" "}
            {current && "Os dados abaixo são da última consulta concluída."}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setError("");
              setAttempt((n) => n + 1);
            }}
          >
            Tentar novamente
          </Button>
        </div>
      )}
      {!current && !error && (
        <p role="status">Conferindo reservas e recebimentos do período…</p>
      )}
      {current && (
        <>
          <MetricStrip
            items={[
              {
                label: "Reservas pela recepcionista",
                value: current.assistant.created,
                detail: "Site, WhatsApp e Instagram · pela criação",
              },
              {
                label: "Atendimentos concluídos",
                value: current.assistant.completed,
                detail: "Dessas origens · pela data agendada",
              },
              {
                label: "Recebido dessas reservas",
                value: money(current.assistant.receivedCents / 100),
                detail: "Pagamentos registrados no período",
              },
            ]}
          />
          <div className="management-table-wrap">
            <table className="management-table">
              <caption className="commercial-caption">
                Compare as origens, sem misturar reserva com recebimento.
              </caption>
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Criados</th>
                  <th>Concluídos</th>
                  <th>Cancelados</th>
                  <th>Faltas</th>
                  <th>Recebido</th>
                </tr>
              </thead>
              <tbody>
                {current.channels.map((c) => (
                  <tr key={c.key}>
                    <td>
                      <strong>{c.label}</strong>
                    </td>
                    <td>{c.created}</td>
                    <td>{c.completed}</td>
                    <td>{c.cancelled}</td>
                    <td>{c.noShow}</td>
                    <td>{money(c.receivedCents / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="commercial-method">
            “Criados” considera a data de criação, inclusive reservas depois
            canceladas. Concluídos, cancelados e faltas usam a data agendada e o
            status atual. “Recebido” soma pagamentos na data do recebimento,
            mesmo para reservas antigas. São fatos independentes, não uma taxa
            de conversão. Registros antigos sem atribuição ficam em “Origem não
            registrada”.
          </p>
          <p className="commercial-method">
            Não há estimativa de receita, lucro ou retorno sobre gasto de IA.
            Última consulta:{" "}
            {new Date(current.checkedAt).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
            .
          </p>
        </>
      )}
    </Card>
  );
}
