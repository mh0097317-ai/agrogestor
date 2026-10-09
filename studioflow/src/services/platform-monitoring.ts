import { createSupabaseAdmin } from "@/lib/supabase/server";
import { DomainError } from "@/lib/availability";
import type { ActivityPeriod } from "@/lib/platform-activity";
import {
  accessEventLabels,
  type AdminEvent,
  type AdminInvoice,
  type PlatformMonitoring,
} from "@/lib/platform-reporting";
import type { AccessEvent } from "@/lib/access";
import { inPeriod } from "@/features/management/finance-helpers";
import { billingReady } from "./billing";
import { demoSlugs, requirePlatformAdmin } from "./platform";
import { isDemo, readDemo } from "./server-demo";
import { readAdminInvoices } from "./platform-monitoring-data";

export async function platformMonitoring(
  period: ActivityPeriod,
): Promise<PlatformMonitoring> {
  await requirePlatformAdmin();
  if (isDemo()) {
    const invoices: AdminInvoice[] = [],
      events: AdminEvent[] = [];
    for (const slug of await demoSlugs()) {
      const store = await readDemo(slug);
      invoices.push(
        ...(store.platformInvoices || [])
          .filter(
            (i) =>
              i.status === "pending" ||
              inPeriod(i.createdAt, period) ||
              (i.paidAt && inPeriod(i.paidAt, period)),
          )
          .map((i) => ({ ...i, businessId: store.business.id })),
      );
      events.push(
        ...(store.accessEvents || [])
          .filter((e) => inPeriod(e.createdAt, period))
          .map((e) => ({
            id: `access:${e.id}`,
            businessId: store.business.id,
            createdAt: e.createdAt,
            label: accessEventLabels[e.action],
            kind: "access" as const,
          })),
      );
    }
    return {
      invoices: invoices.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      events: events
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 50),
      billingReady: false,
    };
  }
  const admin = createSupabaseAdmin();
  const from = `${period.from}T00:00:00-03:00`;
  const to = new Date(
    Date.parse(`${period.to}T00:00:00-03:00`) + 86400000,
  ).toISOString();
  const invoices = await readAdminInvoices(admin, period);
  for (let offset = 0; ; offset += 500) {
    const { data: manual, error: manualError } = await admin
      .from("platform_manual_invoices")
      .select(
        "id,business_id,value,due_date,status,paid_at,created_at,method,note",
      )
      .or(
        `status.eq.pending,and(created_at.gte.${from},created_at.lt.${to}),and(paid_at.gte.${from},paid_at.lt.${to})`,
      )
      .order("id")
      .range(offset, offset + 499);
    if (manualError)
      throw new DomainError(
        "Não foi possível consultar as mensalidades manuais.",
        503,
      );
    invoices.push(
      ...(manual || []).map((i) => ({
        id: i.id,
        businessId: i.business_id,
        value: Number(i.value),
        dueDate: i.due_date,
        status: i.status,
        paidAt: i.paid_at,
        createdAt: i.created_at,
        invoiceUrl: "",
        source: "manual" as const,
        method: i.method,
        note: i.note,
      })),
    );
    if (!manual || manual.length < 500) break;
  }
  const [access, channels] = await Promise.all([
    admin
      .from("platform_access_events")
      .select("id,business_id,action,created_at")
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("platform_channel_events")
      .select("id,business_id,channel,enabled,created_at")
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (access.error || channels.error)
    throw new DomainError(
      "Não foi possível consultar a atividade administrativa.",
      503,
    );
  const events: AdminEvent[] = [
    ...(access.data || []).map((row) => ({
      id: `access:${row.id}`,
      businessId: row.business_id,
      createdAt: row.created_at,
      label: accessEventLabels[row.action as AccessEvent["action"]],
      kind: "access" as const,
    })),
    ...(channels.data || []).map((row) => ({
      id: `channel:${row.id}`,
      businessId: row.business_id,
      createdAt: row.created_at,
      label:
        row.channel === "public_link"
          ? `Link público ${row.enabled ? "ativado" : "desativado"}`
          : `Recepcionista ${row.enabled ? "ativada" : "desativada"}`,
      kind: "channel" as const,
    })),
  ];
  const { data: configuration, error: configurationError } = await admin
    .from("platform_config_events")
    .select("id,business_id,action,created_at")
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: false })
    .limit(50);
  if (configurationError)
    throw new DomainError(
      "Não foi possível consultar o histórico de configurações.",
      503,
    );
  const labels: Record<string, string> = {
    ai_key_saved: "Credencial de IA salva no cofre",
    ai_key_removed: "Credencial de IA removida",
    assistant_settings: "Recepcionista configurada",
    evolution_saved: "Servidor Evolution API configurado",
    manual_invoice_created: "Mensalidade manual registrada",
    manual_invoice_paid: "Pagamento manual recebido",
    manual_invoice_cancelled: "Mensalidade manual cancelada",
  };
  events.push(
    ...(configuration || []).map((e) => ({
      id: `config:${e.id}`,
      businessId: e.business_id || "platform",
      createdAt: e.created_at,
      label: labels[e.action] || "Configuração atualizada",
      kind: "configuration" as const,
    })),
  );
  return {
    invoices: invoices.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    events: events
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50),
    billingReady: billingReady(),
  };
}
