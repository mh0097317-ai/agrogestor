"use client";
import { useState, type FormEvent } from "react";
import { Plus, Download, ArrowUpRight, Wallet } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  DetailPanel,
  EmptyState,
  FormSection,
  MetricStrip,
  PageHeader,
} from "@/components/ui";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/components/toast";
import { businessDay, dateLabel, money, paymentLabels } from "@/lib/utils";
import type { PaymentMethod } from "@/types";
import {
  ManagementBoundary,
  FormField,
  FormError,
  SubmitButton,
  useFormAction,
  downloadCsv,
} from "./shared";
import {
  balanceFor,
  financeSummary,
  periodFor,
  reais,
  validPeriod,
  type FinancePeriod,
  type FinancePreset,
} from "./finance-helpers";
import { PeriodControl } from "./period-control";
const methods: PaymentMethod[] = ["pix", "cash", "credit", "debit", "other"];
export default function FinancePage() {
  const { data, mutate } = useWorkspace(),
    { canMutate } = usePermissions(),
    { toast } = useToast();
  const [period, setPeriod] = useState<FinancePeriod>(() => periodFor("month")),
    [preset, setPreset] = useState<FinancePreset>("month");
  const [open, setOpen] = useState(false),
    [appointmentId, setAppointmentId] = useState("");
  const action = useFormAction(),
    editable = canMutate("payments");
  const summary = data ? financeSummary(data, period) : null;
  const allOutstanding =
    data?.appointments.filter(
      (item) => item.status === "completed" && balanceFor(item, data) > 0,
    ) ?? [];
  const chosen = allOutstanding.find((item) => item.id === appointmentId),
    due = chosen && data ? reais(balanceFor(chosen, data)) : 0;
  function register(id?: string) {
    if (!editable) return;
    action.setError("");
    setAppointmentId(id || allOutstanding[0]?.id || "");
    setOpen(true);
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || !chosen || !data) return;
    const form = new FormData(event.currentTarget),
      amount = Number(form.get("amount")),
      method = String(form.get("method")) as PaymentMethod;
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      Math.round(amount * 100) > Math.round(due * 100) ||
      !methods.includes(method)
    ) {
      action.setError("Informe um valor válido, até o saldo restante.");
      return;
    }
    void action.run(async () => {
      await mutate("payments", "create", {
        id: crypto.randomUUID(),
        businessId: data.business.id,
        appointmentId: chosen.id,
        amount,
        method,
      });
      toast("Pagamento registrado.");
      setOpen(false);
    });
  }
  function exportCsv() {
    if (!summary || !data) return;
    downloadCsv(
      [
        ["Data", "Cliente", "Profissional", "Forma", "Valor recebido"],
        ...summary.payments.map((payment) => {
          const appointment = summary.appointmentById.get(
            payment.appointmentId,
          );
          return [
            dateLabel(payment.createdAt, "dd/MM/yyyy HH:mm"),
            appointment?.customerName || "",
            data.professionals.find(
              (person) => person.id === appointment?.professionalId,
            )?.name || "",
            paymentLabels[payment.method],
            payment.amount.toFixed(2).replace(".", ","),
          ];
        }),
      ],
      "recebimentos-" + businessDay() + ".csv",
    );
    toast("Recebimentos do período exportados.");
  }
  return (
    <ManagementBoundary>
      <PageHeader
        title="Financeiro"
        description="Acompanhe o que entrou e o que ainda falta receber."
        actions={
          editable ? (
            <Button onClick={() => register()}>
              <Plus size={17} />
              Registrar pagamento
            </Button>
          ) : undefined
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
      {summary && (
        <>
          <Card className="finance-overview">
            <div>
              <span className="management-eyebrow">
                <Wallet size={16} />
                Recebido no período
              </span>
              <strong>{money(reais(summary.revenueCents))}</strong>
              <p>
                {summary.payments.length} pagamentos · pela data de recebimento
              </p>
            </div>
            <div className="finance-overview-balance">
              <span>A receber dos atendimentos do período</span>
              <strong>{money(reais(summary.dueCents))}</strong>
              <small>
                {summary.outstanding.length} atendimentos com saldo em aberto
              </small>
            </div>
          </Card>
          <MetricStrip
            items={[
              {
                label: "Atendimentos concluídos",
                value: summary.completed.length,
                detail: "Pela data do atendimento",
              },
              {
                label: "Ticket médio",
                value: money(reais(summary.averageTicketCents)),
                detail: "Valor contratado por atendimento",
              },
              {
                label: "Média recebida",
                value: money(reais(summary.averageReceiptCents)),
                detail: "Por atendimento com pagamento",
              },
              {
                label: "Comissão estimada",
                value: money(reais(summary.commissionCents)),
                detail: "Percentual atual sobre recebimentos",
              },
            ]}
          />
          <div className="management-two-columns">
            <Card className="management-panel">
              <div className="management-section-heading">
                <div>
                  <h2>Formas de pagamento</h2>
                  <p>Distribuição dos recebimentos selecionados.</p>
                </div>
              </div>
              <div className="management-bars">
                {summary.paymentMethods.map((item) => (
                  <div key={item.method}>
                    <div className="management-bar-label">
                      <span>{paymentLabels[item.method]}</span>
                      <strong>{money(reais(item.amountCents))}</strong>
                    </div>
                    <div className="management-bar-track">
                      <div
                        className="management-bar-fill"
                        style={{
                          width:
                            (summary.revenueCents
                              ? (item.amountCents / summary.revenueCents) * 100
                              : 0) + "%",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="management-panel">
              <div className="management-section-heading">
                <div>
                  <h2>Valores a receber</h2>
                  <p>
                    Concluídos no período; saldo considera todos os pagamentos.
                  </p>
                </div>
              </div>
              {summary.outstanding.length ? (
                <div className="finance-pending-list">
                  {summary.outstanding.map(({ appointment, dueCents }) => (
                    <div key={appointment.id}>
                      <div>
                        <strong>{appointment.customerName}</strong>
                        <small>
                          {dateLabel(appointment.start, "dd MMM · HH:mm")}
                        </small>
                      </div>
                      <strong>{money(reais(dueCents))}</strong>
                      {editable && (
                        <button
                          className="management-icon-button"
                          aria-label={
                            "Registrar pagamento de " + appointment.customerName
                          }
                          onClick={() => register(appointment.id)}
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Tudo em dia neste período"
                  description="Não há atendimentos concluídos com saldo a receber."
                />
              )}
            </Card>
          </div>
          <Card className="management-panel">
            <div className="management-section-heading">
              <div>
                <h2>Recebimentos</h2>
                <p>
                  {summary.payments.length} pagamentos no período selecionado.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={exportCsv}
                disabled={!summary.payments.length}
              >
                <Download size={16} />
                Exportar CSV
              </Button>
            </div>
            {summary.payments.length ? (
              <div className="management-table-wrap">
                <table className="management-table finance-receipts">
                  <thead>
                    <tr>
                      <th>Cliente / data</th>
                      <th>Profissional</th>
                      <th>Pagamento</th>
                      <th>Recebido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.payments.map((payment) => {
                      const appointment = summary.appointmentById.get(
                          payment.appointmentId,
                        ),
                        professional = data?.professionals.find(
                          (person) => person.id === appointment?.professionalId,
                        );
                      return (
                        <tr key={payment.id}>
                          <td>
                            <strong>
                              {appointment?.customerName ||
                                "Cliente indisponível"}
                            </strong>
                            <small>
                              {dateLabel(
                                payment.createdAt,
                                "dd MMM yyyy · HH:mm",
                              )}
                            </small>
                          </td>
                          <td>{professional?.name || "—"}</td>
                          <td>
                            <span className="management-pill">
                              {paymentLabels[payment.method]}
                            </span>
                          </td>
                          <td>
                            <strong>{money(payment.amount)}</strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="Sem recebimentos"
                description="Os pagamentos registrados aparecerão aqui."
              />
            )}
          </Card>
          <Card className="management-panel">
            <div className="management-section-heading">
              <div>
                <h2>Comissões por profissional</h2>
                <p>
                  Estimativas sobre recebimentos. Não representam repasses
                  realizados.
                </p>
              </div>
              <span className="management-pill">Percentual atual</span>
            </div>
            <div className="management-table-wrap">
              <table className="management-table">
                <thead>
                  <tr>
                    <th>Profissional</th>
                    <th>Percentual</th>
                    <th>Recebimentos</th>
                    <th>Estimativa</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.professionals.map((item) => (
                    <tr key={item.professional.id}>
                      <td>
                        <div className="management-person">
                          <Avatar
                            name={item.professional.name}
                            src={item.professional.photo}
                            size={32}
                          />
                          <strong>{item.professional.name}</strong>
                        </div>
                      </td>
                      <td>{item.professional.commission}%</td>
                      <td>{money(reais(item.receivedCents))}</td>
                      <td>
                        <strong>{money(reais(item.commissionCents))}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="management-top-description">
              O percentual atual também é aplicado a recebimentos antigos.
              Histórico de taxas e controle de repasses ainda não estão
              disponíveis.
            </p>
          </Card>
        </>
      )}
      <DetailPanel
        open={open}
        onClose={() => {
          if (!action.busy) setOpen(false);
        }}
        title="Registrar pagamento"
        description="Registre o valor recebido de um atendimento concluído."
      >
        {allOutstanding.length ? (
          <form className="management-form" onSubmit={save}>
            <FormSection title="Atendimento">
              <FormField label="Cliente e horário">
                <select
                  required
                  value={appointmentId}
                  onChange={(event) => {
                    setAppointmentId(event.target.value);
                    action.setError("");
                  }}
                >
                  <option value="">Selecione um atendimento</option>
                  {allOutstanding.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.customerName} ·{" "}
                      {dateLabel(item.start, "dd/MM HH:mm")}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="management-info">
                Saldo restante: <strong>{money(due)}</strong>. Pagamentos
                parciais são permitidos.
              </div>
            </FormSection>
            <FormSection title="Recebimento">
              <div className="management-form-grid">
                <FormField label="Valor recebido (R$)">
                  <input
                    key={appointmentId}
                    name="amount"
                    type="number"
                    required
                    min="0.01"
                    max={due || undefined}
                    step="0.01"
                    defaultValue={due.toFixed(2)}
                  />
                </FormField>
                <FormField label="Forma de pagamento">
                  <select name="method">
                    {methods.map((method) => (
                      <option key={method} value={method}>
                        {paymentLabels[method]}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </FormSection>
            <FormError error={action.error} />
            <div className="management-form-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={action.busy}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <SubmitButton busy={action.busy}>
                Registrar pagamento
              </SubmitButton>
            </div>
          </form>
        ) : (
          <EmptyState
            title="Nenhum saldo pendente"
            description="Conclua um atendimento na agenda para registrar o pagamento."
          />
        )}
      </DetailPanel>
    </ManagementBoundary>
  );
}
