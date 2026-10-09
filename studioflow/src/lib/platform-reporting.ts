import type { PlatformBusiness } from "@/services/platform";
import type { AccessEvent } from "./access";
import type { PlatformInvoice } from "@/types";
import { hasModule, planCatalog, planFor } from "./modules";
import { emptyActivity, type ActivityPeriod } from "./platform-activity";
import { inPeriod, cents, reais } from "@/features/management/finance-helpers";

export interface AdminInvoice extends PlatformInvoice {
  businessId: string;
  source?: "manual";
  method?: string;
  note?: string;
}
export interface AdminEvent {
  id: string;
  businessId: string;
  createdAt: string;
  label: string;
  kind: "access" | "channel" | "configuration";
}
export interface PlatformMonitoring {
  invoices: AdminInvoice[];
  events: AdminEvent[];
  billingReady: boolean;
}
export type IntegrationReadiness = { evolution: boolean; ai: boolean };
export const accessEventLabels: Record<AccessEvent["action"], string> = {
  created: "Cadastro recebido",
  granted: "Acesso liberado",
  unlimited: "Acesso sem prazo",
  until: "Prazo de acesso definido",
  suspended: "Acesso pausado",
  pending: "Voltou para aguardando",
  note: "Anotação atualizada",
  plan: "Plano e módulos atualizados",
  paid: "Mensalidade paga",
};
export function platformPlanLabel(
  item: Pick<PlatformBusiness, "plan" | "modules">,
) {
  if (item.plan) return item.plan;
  if (!item.modules) return "Completo";
  const key = planFor(item.modules);
  return key ? planCatalog[key].label : "Personalizado";
}
export function receptionistState(
  item: PlatformBusiness,
  integrations: IntegrationReadiness | null,
) {
  if (!hasModule(item.modules, "recepcionista"))
    return { id: "plan", label: "Fora do plano" };
  if (!item.assistantEnabled) return { id: "disabled", label: "Desativada" };
  if (!["active", "expiring"].includes(item.state))
    return { id: "access", label: "Acesso bloqueado" };
  if (!integrations?.evolution || !(item.aiConfigured || integrations?.ai))
    return { id: "configuration", label: "Configuração pendente" };
  if (item.whatsappStatus === "connecting")
    return { id: "connecting", label: "Aguardando QR Code" };
  if (item.whatsappStatus !== "open")
    return { id: "disconnected", label: "WhatsApp desconectado" };
  return { id: "ready", label: "Pronta para atender" };
}
export function aggregateActivity(items: PlatformBusiness[]) {
  const result = emptyActivity();
  for (const item of items)
    for (const key of Object.keys(result) as (keyof typeof result)[])
      result[key] += item.activity[key];
  return result;
}
export function invoiceState(invoice: AdminInvoice, today: string) {
  return invoice.status === "pending" && invoice.dueDate < today
    ? "overdue"
    : invoice.status;
}
export function billingSummary(
  invoices: AdminInvoice[],
  period: ActivityPeriod,
  today: string,
) {
  const sum = (rows: AdminInvoice[]) =>
    reais(rows.reduce((total, i) => total + cents(i.value), 0));
  const paid = invoices.filter(
    (i) => i.status === "paid" && i.paidAt && inPeriod(i.paidAt, period),
  );
  const open = invoices.filter((i) => i.status === "pending");
  const overdue = open.filter((i) => invoiceState(i, today) === "overdue");
  return {
    received: sum(paid),
    paid: paid.length,
    outstanding: sum(open),
    pending: open.length,
    overdue: sum(overdue),
    overdueCount: overdue.length,
  };
}
/** Escapes spreadsheet formulas from owner-provided names, emails and notes. */
export function reportCsv(rows: (string | number)[][]) {
  const cell = (value: string | number) => {
    let text =
      typeof value === "number"
        ? value.toLocaleString("pt-BR", {
            useGrouping: false,
            maximumFractionDigits: 10,
          })
        : value;
    if (typeof value === "string" && /^\s*[=+\-@]/.test(text))
      text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
}
export function businessReport(
  items: PlatformBusiness[],
  period: ActivityPeriod,
) {
  return reportCsv([
    [
      "Estabelecimento",
      "Plano",
      "Situação",
      "Mensalidade combinada",
      "Link público",
      "Recepcionista",
      "WhatsApp",
      "Clientes cadastrados",
      "Clientes que agendaram",
      "Agendamentos",
      "Agendamentos IA",
      "Agendamentos IA WhatsApp",
      "Clientes IA",
      "Conversas",
      "Aguardando humano agora",
      "Recebido pela loja",
      "Recebido de agendamentos IA",
      "Valor agendado",
      "Respostas IA",
      "Tokens entrada",
      "Tokens saída",
      "Início do período",
      "Fim do período",
    ],
    ...items.map((i) => [
      i.name,
      platformPlanLabel(i),
      {
        pending: "Aguardando liberação",
        active: "Liberado",
        expiring: "Vence em breve",
        expired: "Vencido",
        suspended: "Pausado",
      }[i.state],
      i.price ?? "",
      i.onlineBookingEnabled ? "Ativado" : "Desativado",
      i.assistantEnabled ? "Ativada" : "Desativada",
      i.whatsappStatus === "open"
        ? "Conectado"
        : i.whatsappStatus === "connecting"
          ? "Aguardando QR Code"
          : "Desconectado",
      i.customers,
      i.activity.bookingCustomers,
      i.activity.appointments,
      i.activity.assistantBookings,
      i.activity.whatsappBookings,
      i.activity.assistantCustomers,
      i.activity.conversations,
      i.activity.waitingHuman,
      i.activity.received,
      i.activity.assistantReceived,
      i.activity.bookedValue,
      i.activity.turns,
      i.activity.inputTokens,
      i.activity.outputTokens,
      period.from,
      period.to,
    ]),
  ]);
}
