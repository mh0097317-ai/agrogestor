import type { BusinessAccess } from "@/lib/access";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { billingReady, reminderStage, reminderText } from "./billing";
import { platformSend } from "./whatsapp/platform";

/**
 * Todo dia: quem vence em 3 dias, hoje, ou venceu há pouco recebe no
 * WhatsApp o link para pagar. Cada aviso sai uma vez por vencimento.
 */
export async function sendBillingReminders(origin: string, now = new Date()) {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc("platform_overview");
  if (error) throw new Error("overview");
  const report = { checked: 0, sent: 0, skipped: 0 };
  for (const item of data as Record<string, unknown>[]) {
    report.checked++;
    const access: BusinessAccess = {
      status: item.status as BusinessAccess["status"],
      until: (item.access_until as string | null) ?? null,
      plan: (item.plan as string) || "",
      price: item.monthly_price === null || item.monthly_price === undefined ? null : Number(item.monthly_price),
    };
    const stage = reminderStage(access, now);
    const phone = String(item.phone || "").replace(/\D/g, "");
    if (!stage || phone.length < 10) continue;
    // Claims the notice first, so two runs never send it twice.
    const { data: claimed } = await admin
      .from("platform_billing_notices")
      .upsert(
        { business_id: item.id, stage, period_until: access.until },
        { onConflict: "business_id,stage,period_until", ignoreDuplicates: true },
      )
      .select("business_id");
    if (!claimed?.length) {
      report.skipped++;
      continue;
    }
    // The open invoice link when there is one; otherwise the panel, where they pay.
    const { data: invoice } = await admin
      .from("platform_invoices")
      .select("invoice_url")
      .eq("business_id", item.id)
      .eq("status", "pending")
      .maybeSingle();
    const link = (billingReady() && (invoice?.invoice_url as string)) || `${origin}/dashboard`;
    const text = reminderText({
      stage,
      owner: String(item.owner_name || ""),
      business: String(item.name || ""),
      plan: access.plan || "",
      price: access.price || 0,
      link,
    });
    const sent = await platformSend(phone, text).catch(() => false);
    if (sent) report.sent++;
    else {
      // Not sent (number off): free the claim so tomorrow tries again.
      await admin
        .from("platform_billing_notices")
        .delete()
        .eq("business_id", item.id)
        .eq("stage", stage)
        .eq("period_until", access.until);
      report.skipped++;
    }
  }
  return report;
}
