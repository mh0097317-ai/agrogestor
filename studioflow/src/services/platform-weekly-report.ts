import type { SupabaseClient } from "@supabase/supabase-js";
import { platformWeeklySummary } from "@/lib/platform-weekly-report";
import { weeklyPeriod } from "@/lib/weekly-report";
import { DomainError } from "@/lib/availability";
import { requirePlatformAdmin, platformOverview } from "./platform";
import { platformMonitoring } from "./platform-monitoring";
import { readAdminInvoices } from "./platform-monitoring-data";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isDemo } from "./server-demo";
import type { AdminInvoice } from "@/lib/platform-reporting";
import type { BusinessAccess } from "@/lib/access";

/** Called only after admin authorization, or by the authenticated internal scheduler. */
export async function queryPlatformWeeklyReport(
  admin: SupabaseClient,
  week?: string,
  now = new Date(),
) {
  const period = weeklyPeriod(week, now);
  const { data, error } = await admin.rpc("platform_overview");
  if (error || !data)
    throw new DomainError(
      "Não foi possível conferir a carteira da plataforma.",
      503,
    );
  const invoices = await readAdminInvoices(admin, period);
  const from = `${period.from}T00:00:00-03:00`,
    to = new Date(
      Date.parse(`${period.to}T00:00:00-03:00`) + 86400000,
    ).toISOString();
  for (let lo = 0; ; lo += 500) {
    const { data: rows, error } = await admin
      .from("platform_manual_invoices")
      .select("id,business_id,value,due_date,status,paid_at,created_at")
      .or(
        `status.eq.pending,and(created_at.gte.${from},created_at.lt.${to}),and(paid_at.gte.${from},paid_at.lt.${to})`,
      )
      .order("id")
      .range(lo, lo + 499);
    if (error || !rows)
      throw new DomainError(
        "Não foi possível conferir os recebimentos manuais.",
        503,
      );
    invoices.push(
      ...(rows.map((r) => ({
        id: r.id,
        businessId: r.business_id,
        value: Number(r.value),
        dueDate: r.due_date,
        status: r.status,
        paidAt: r.paid_at,
        createdAt: r.created_at,
        invoiceUrl: "",
      })) as AdminInvoice[]),
    );
    if (rows.length < 500) break;
  }
  return platformWeeklySummary(
    (data as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      status: r.status as BusinessAccess["status"],
      until: r.access_until as string | null,
      createdAt: String(r.created_at),
    })),
    invoices,
    week,
    now,
  );
}
export async function platformWeeklyReport(week?: string) {
  await requirePlatformAdmin();
  const period = weeklyPeriod(week);
  if (isDemo()) {
    const [businesses, monitoring] = await Promise.all([
      platformOverview(new Date(), period),
      platformMonitoring(period),
    ]);
    return platformWeeklySummary(
      businesses,
      monitoring.invoices,
      week,
      new Date(),
      true,
    );
  }
  return queryPlatformWeeklyReport(createSupabaseAdmin(), week);
}
