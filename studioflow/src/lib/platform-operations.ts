import type { PlatformBusiness } from "@/services/platform";
import { hasModule } from "./modules";
import {
  invoiceState,
  receptionistState,
  type AdminInvoice,
  type IntegrationReadiness,
} from "./platform-reporting";
import { cents, reais } from "@/features/management/finance-helpers";

export type OperationFilter =
  "all" | "attention" | "human" | "ready" | "overdue" | "vault";

/** Current operating state; invoice debt is independent of the report period. */
export function businessOperations(
  item: PlatformBusiness,
  invoices: AdminInvoice[] | null,
  integrations: IntegrationReadiness | null,
  today: string,
) {
  const receptionist = receptionistState(item, integrations);
  const ownInvoices = invoices?.filter((i) => i.businessId === item.id);
  const open = ownInvoices?.filter((i) => i.status === "pending");
  const overdue = open?.filter((i) => invoiceState(i, today) === "overdue");
  const active = ["active", "expiring"].includes(item.state);
  const usesAssistant =
    item.assistantEnabled && hasModule(item.modules, "recepcionista");
  const missingAi = usesAssistant && !item.aiConfigured && !integrations?.ai;
  const reasons: string[] = [];
  if (item.state === "pending") reasons.push("Acesso aguardando liberação");
  if (item.state === "expired") reasons.push("Acesso vencido");
  if (item.state === "expiring") reasons.push("Acesso vence em breve");
  if ((overdue?.length || 0) > 0)
    reasons.push(`${overdue!.length} mensalidade(s) vencida(s)`);
  if (item.activity.waitingHuman > 0)
    reasons.push(`${item.activity.waitingHuman} conversa(s) aguardando humano`);
  if (active && usesAssistant) {
    if (!integrations?.evolution) reasons.push("Servidor Evolution pendente");
    if (missingAi) reasons.push("Credencial de IA pendente");
    if (item.whatsappStatus !== "open")
      reasons.push(
        item.whatsappStatus === "connecting"
          ? "Aguardando leitura do QR Code"
          : "WhatsApp desconectado",
      );
  }
  const sum = (rows: AdminInvoice[] | undefined) =>
    rows ? reais(rows.reduce((total, i) => total + cents(i.value), 0)) : null;
  return {
    item,
    active,
    receptionist,
    reasons,
    missingAi,
    openInvoices: open?.length ?? null,
    outstanding: sum(open),
    overdueInvoices: overdue?.length ?? null,
    overdue: sum(overdue),
  };
}

export type BusinessOperation = ReturnType<typeof businessOperations>;
export function matchesOperation(
  row: BusinessOperation,
  filter: OperationFilter,
) {
  if (filter === "attention") return row.reasons.length > 0;
  if (filter === "human") return row.item.activity.waitingHuman > 0;
  if (filter === "ready") return row.receptionist.id === "ready";
  if (filter === "overdue") return (row.overdueInvoices ?? 0) > 0;
  if (filter === "vault") return row.missingAi;
  return true;
}
