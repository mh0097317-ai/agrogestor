import { z } from "zod";
import { getWorkspace, getPublicStore } from "./server-store";
import { createSupabaseAdmin, readBusinessAccess } from "@/lib/supabase/server";
import { accessOpen } from "@/lib/access";
import { DomainError } from "@/lib/availability";
import { weeklyPeriod, weeklySummary } from "@/lib/weekly-report";
import { queryWeeklyRows } from "./weekly-report";
import { weeklyReportPdf } from "./weekly-report-pdf";
import { pdfSender } from "./whatsapp/link";

export const weeklyPreferencesSchema = z
  .object({
    enabled: z.boolean(),
    includeProfessionals: z.boolean(),
    ownerPhone: z
      .string()
      .transform((s) => s.replace(/\D/g, ""))
      .refine(
        (s) => s === "" || /^\d{10,15}$/.test(s),
        "Informe o WhatsApp do dono com DDD.",
      ),
    /** O mesmo PDF no e-mail de login do dono (StudioFlow → Resend). */
    emailEnabled: z.boolean().default(true),
  })
  .strict()
  .refine(
    (v) => !v.enabled || !!v.ownerPhone,
    "Informe o número do dono antes de ativar.",
  );
export async function weeklyPreferences(input?: unknown) {
  const store = await getWorkspace();
  if (!["owner", "admin", "manager"].includes(store.viewer?.role || ""))
    throw new DomainError("Somente a gestão configura os envios.", 403);
  const defaults = {
    enabled: false,
    includeProfessionals: true,
    ownerPhone: "",
    emailEnabled: true,
  };
  if (store.mode === "demo") {
    if (input)
      throw new DomainError(
        "Envios automáticos não são ativados na demonstração.",
      );
    return defaults;
  }
  const admin = createSupabaseAdmin();
  if (input !== undefined) {
    const values = weeklyPreferencesSchema.parse(input);
    const { error } = await admin
      .from("weekly_report_preferences")
      .upsert({
        business_id: store.business.id,
        enabled: values.enabled,
        include_professionals: values.includeProfessionals,
        owner_phone: values.ownerPhone,
        email_enabled: values.emailEnabled,
        updated_at: new Date().toISOString(),
      });
    if (error)
      throw new DomainError("Não foi possível salvar o envio semanal.", 503);
    return values;
  }
  const { data, error } = await admin
    .from("weekly_report_preferences")
    .select("enabled,include_professionals,owner_phone,email_enabled")
    .eq("business_id", store.business.id)
    .maybeSingle();
  if (error)
    throw new DomainError(
      "O envio semanal ainda não está disponível neste ambiente.",
      503,
    );
  return data
    ? {
        enabled: data.enabled,
        includeProfessionals: data.include_professionals,
        ownerPhone: data.owner_phone,
        emailEnabled: data.email_enabled !== false,
      }
    : defaults;
}
export function weeklySendWindow(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(now);
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return day === "Mon" && hour === "09";
}
/** Uncertain sends stay claimed and are never replayed automatically. */
export async function deliverWeeklyPdf(input: {
  claim: () => Promise<boolean>;
  build: () => Promise<Uint8Array>;
  send: (pdf: Uint8Array) => Promise<string>;
  receipt: (status: "sent" | "failed", id?: string) => Promise<void>;
}) {
  if (!(await input.claim())) return "skipped" as const;
  try {
    const id = await input.send(await input.build());
    if (!id?.trim()) throw Error("provider acknowledgement missing");
    await input.receipt("sent", id);
    return "sent" as const;
  } catch {
    await input.receipt("failed").catch(() => undefined);
    return "failed" as const;
  }
}
export async function sendWeeklyReports(now = new Date()) {
  const totals = { checked: 0, sent: 0, failed: 0, skipped: 0 };
  if (!weeklySendWindow(now)) return totals;
  const admin = createSupabaseAdmin();
  const { data: preferences, error } = await admin
    .from("weekly_report_preferences")
    .select("business_id,owner_phone,include_professionals")
    .eq("enabled", true)
    .order("business_id")
    .limit(100);
  if (error) throw Error("weekly report preferences unavailable");
  const { from: week } = weeklyPeriod(undefined, now);
  let attempted = 0;
  for (const pref of preferences || []) {
    if (!accessOpen(await readBusinessAccess(pref.business_id))) continue;
    const { data: business, error: readError } = await admin
      .from("businesses")
      .select("slug")
      .eq("id", pref.business_id)
      .single();
    if (readError || !business) {
      totals.failed++;
      continue;
    }
    const store = await getPublicStore(business.slug);
    const jobs = [
      {
        id: "owner",
        phone: pref.owner_phone,
        professionalId: undefined as string | undefined,
      },
      ...(pref.include_professionals
        ? store.professionals
            .filter(
              (p) => p.active && p.businessId === store.business.id && p.phone,
            )
            .map((p) => ({ id: p.id, phone: p.phone, professionalId: p.id }))
        : []),
    ];
    for (const job of jobs) {
      if (attempted >= 3) return totals;
      totals.checked++;
      if (!/^\d{10,15}$/.test(job.phone.replace(/\D/g, ""))) {
        totals.skipped++;
        continue;
      }
      let send = await pdfSender(store.business.id, job.professionalId);
      if (!send) send = await pdfSender(store.business.id);
      if (!send && !job.professionalId) {
        for (const p of store.professionals.filter((p) => p.active)) {
          send = await pdfSender(store.business.id, p.id);
          if (send) break;
        }
      }
      if (!send) {
        totals.skipped++;
        continue;
      }
      const sender = send,
        key = { business_id: store.business.id, week, target: job.id };
      const status = await deliverWeeklyPdf({
        claim: async () => {
          const { error } = await admin
            .from("weekly_report_deliveries")
            .insert(key);
          if (error?.code === "23505") return false;
          if (error) throw Error("weekly report claim failed");
          attempted++;
          return true;
        },
        build: async () => {
          const rows = await queryWeeklyRows(
            admin,
            store.business.id,
            week,
            job.professionalId,
          );
          return weeklyReportPdf(
            weeklySummary(
              store,
              week,
              job.professionalId,
              rows.appointments,
              rows.receipts,
              rows.sales,
              now,
            ),
          );
        },
        send: (bytes) =>
          sender(
            job.phone,
            bytes,
            `studioflow-semanal-${job.id === "owner" ? "dono" : "profissional"}-${week}.pdf`,
            "Seu relatório semanal StudioFlow: resultados da semana anterior, de segunda a domingo.",
          ),
        receipt: async (status, id) => {
          const { error } = await admin
            .from("weekly_report_deliveries")
            .update({
              status,
              ...(id
                ? { provider_message_id: id, sent_at: now.toISOString() }
                : {}),
            })
            .match(key);
          if (error) throw Error("weekly report receipt failed");
        },
      });
      totals[status]++;
    }
  }
  return totals;
}
