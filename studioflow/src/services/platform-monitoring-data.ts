import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityPeriod } from "@/lib/platform-activity";
import type { AdminInvoice } from "@/lib/platform-reporting";
import { DomainError } from "@/lib/availability";

/** Called only after platform-admin authorization; no provider-side actions. */
export async function readAdminInvoices(
  admin: SupabaseClient,
  period: ActivityPeriod,
): Promise<AdminInvoice[]> {
  const from = `${period.from}T00:00:00-03:00`;
  const to = new Date(
    Date.parse(`${period.to}T00:00:00-03:00`) + 86400000,
  ).toISOString();
  const invoices: AdminInvoice[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin
      .from("platform_invoices")
      .select(
        "id,business_id,value,due_date,status,invoice_url,paid_at,created_at",
      )
      .or(
        `status.eq.pending,and(created_at.gte.${from},created_at.lt.${to}),and(paid_at.gte.${from},paid_at.lt.${to})`,
      )
      .order("id")
      .range(offset, offset + 499);
    if (error)
      throw new DomainError("Não foi possível consultar as mensalidades.", 503);
    for (const row of data || [])
      invoices.push({
        id: row.id,
        businessId: row.business_id,
        value: Number(row.value),
        dueDate: row.due_date,
        status: row.status,
        invoiceUrl: row.invoice_url || "",
        paidAt: row.paid_at,
        createdAt: row.created_at,
      });
    if (!data || data.length < 500) return invoices;
  }
}
