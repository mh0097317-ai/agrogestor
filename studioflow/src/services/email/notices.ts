import { createSupabaseAdmin, readBusinessAccess } from "@/lib/supabase/server";
import { accessOpen } from "@/lib/access";
import { getPublicStore } from "../server-store";
import { appointmentEmail, type AppointmentEmailKind } from "./appointment-email";
import { emailConfigured, sendEmail } from "./resend";

/** Confirmação e lembrete da véspera por e-mail. Cada aviso é reivindicado uma vez só. */
export async function sendEmailNotices() {
  const report = { checked: 0, sent: 0, failed: 0 };
  if (!emailConfigured()) return report;
  const admin = createSupabaseAdmin();
  const { data, error } = (await admin.rpc("due_email_notices")) as {
    data:
      | { id: string; business_id: string; start: string; kind: AppointmentEmailKind; email: string }[]
      | null;
    error: unknown;
  };
  if (error) throw new Error("email notice query failed");
  report.checked = data?.length || 0;
  const slugs = new Map<string, string | null>();
  for (const row of data || []) {
    const mark = (status: "sent" | "failed") =>
      admin
        .from("appointment_email_notices")
        .update(status === "sent" ? { status, sent_at: new Date().toISOString() } : { status })
        .eq("appointment_id", row.id)
        .eq("kind", row.kind)
        .eq("appointment_start", row.start);
    try {
      if (!accessOpen(await readBusinessAccess(row.business_id))) continue;
      if (!slugs.has(row.business_id)) {
        const { data: business } = await admin
          .from("businesses")
          .select("slug")
          .eq("id", row.business_id)
          .maybeSingle();
        slugs.set(row.business_id, business?.slug || null);
      }
      const slug = slugs.get(row.business_id);
      if (!slug) continue;
      const store = await getPublicStore(slug);
      const appointment = store.appointments.find((a) => a.id === row.id);
      if (!appointment) continue;
      const { data: claimed, error: claimError } = await admin.rpc(
        "claim_email_notice",
        { p_id: row.id, p_kind: row.kind, p_start: row.start },
      );
      if (claimError) throw new Error("email claim failed");
      if (!claimed) continue;
      try {
        await sendEmail(
          appointmentEmail(row.kind, store, appointment, row.email),
          `appointment-${row.kind}-${row.id}-${Date.parse(row.start)}`,
        );
        await mark("sent");
        report.sent++;
      } catch {
        await mark("failed");
        report.failed++;
      }
    } catch {
      report.failed++;
    }
  }
  return report;
}
