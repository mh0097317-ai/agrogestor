import { requirePlatformAdmin } from "./platform";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  weeklyPreferencesSchema,
  deliverWeeklyPdf,
  weeklySendWindow,
} from "./weekly-report-delivery";
import { weeklyPeriod } from "@/lib/weekly-report";
import { DomainError } from "@/lib/availability";
import { queryPlatformWeeklyReport } from "./platform-weekly-report";
import { weeklyReportPdf } from "./weekly-report-pdf";
import { platformPdfSender } from "./whatsapp/platform";
import { isDemo } from "./server-demo";
export async function platformWeeklyPreferences(input?: unknown) {
  await requirePlatformAdmin();
  if (isDemo()) {
    if (input !== undefined)
      throw new DomainError("Envio real indisponível na demonstração.");
    return { enabled: false, ownerPhone: "", includeProfessionals: false };
  }
  const admin = createSupabaseAdmin();
  if (input !== undefined) {
    const p = weeklyPreferencesSchema.parse(input);
    const { error } = await admin
      .from("platform_weekly_report_preferences")
      .upsert({
        id: true,
        enabled: p.enabled,
        owner_phone: p.ownerPhone,
        updated_at: new Date().toISOString(),
      });
    if (error)
      throw new DomainError(
        "Não foi possível salvar os envios da plataforma.",
        503,
      );
    return { ...p, includeProfessionals: false };
  }
  const { data, error } = await admin
    .from("platform_weekly_report_preferences")
    .select("enabled,owner_phone")
    .eq("id", true)
    .maybeSingle();
  if (error)
    throw new DomainError(
      "O envio da plataforma ainda não está disponível.",
      503,
    );
  return {
    enabled: data?.enabled || false,
    ownerPhone: data?.owner_phone || "",
    includeProfessionals: false,
  };
}
export async function sendPlatformWeeklyReport(now = new Date()) {
  if (!weeklySendWindow(now)) return "skipped" as const;
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("platform_weekly_report_preferences")
    .select("enabled,owner_phone")
    .eq("id", true)
    .maybeSingle();
  if (error) throw Error("platform weekly preferences unavailable");
  if (!data?.enabled || !data.owner_phone) return "skipped" as const;
  const send = await platformPdfSender();
  if (!send) return "skipped" as const;
  const { from: week } = weeklyPeriod(undefined, now);
  return deliverWeeklyPdf({
    claim: async () => {
      const { error } = await admin
        .from("platform_weekly_report_deliveries")
        .insert({ week });
      if (error?.code === "23505") return false;
      if (error) throw Error("platform report claim failed");
      return true;
    },
    build: async () =>
      weeklyReportPdf(await queryPlatformWeeklyReport(admin, week, now)),
    send: (bytes) =>
      send(
        data.owner_phone,
        bytes,
        `studioflow-semanal-plataforma-${week}.pdf`,
        "Relatório semanal da plataforma StudioFlow - documento confidencial do administrador.",
      ),
    receipt: async (status, id) => {
      const { error } = await admin
        .from("platform_weekly_report_deliveries")
        .update({
          status,
          ...(id
            ? { provider_message_id: id, sent_at: now.toISOString() }
            : {}),
        })
        .eq("week", week);
      if (error) throw Error("platform report receipt failed");
    },
  });
}
