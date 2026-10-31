import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requestOrigin } from "@/services/server-http";
import {
  sendAppointmentReminders,
  recoverProfessionalBookingNotices,
} from "@/services/whatsapp/reminders";
import { sendEmailNotices } from "@/services/email/notices";
import {
  sendWeeklyReports,
  sendDailyReports,
  weeklySendWindow,
} from "@/services/weekly-report-delivery";
import { sendWeeklyEmails } from "@/services/email/platform-emails";
import { sendPlatformWeeklyReport } from "@/services/platform-weekly-delivery";
import {
  sendAttendanceChecks,
  sendOwnerUnsettledAlerts,
} from "@/services/attendance";
import { checkAssistantHealth } from "@/services/assistant/alerts";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(
    /^Bearer /,
    "",
  );
  if (!/^[a-f0-9]{64}$/.test(token))
    return new Response("forbidden", { status: 401 });
  const { data: valid, error } = await createSupabaseAdmin().rpc(
    "verify_appointment_scheduler",
    { p_secret: token },
  );
  if (error || valid !== true)
    return new Response("forbidden", { status: 401 });
  const origin = requestOrigin(request);
  const failed = { checked: 0, sent: 0, skipped: 0, failed: 1 };
  const [
    customers,
    professionals,
    emails,
    attendance,
    owners,
    weeklyReports,
    dailyReports,
    platformWeeklyReport,
    weeklyEmails,
    assistantHealth,
  ] = await Promise.all([
    sendAppointmentReminders(),
    recoverProfessionalBookingNotices(origin),
    sendEmailNotices().catch(() => ({ checked: 0, sent: 0, failed: 1 })),
    sendAttendanceChecks(origin).catch(() => failed),
    sendOwnerUnsettledAlerts(origin).catch(() => failed),
    sendWeeklyReports().catch(() => failed),
    sendDailyReports().catch(() => failed),
    sendPlatformWeeklyReport().catch(() => "failed"),
    // Segunda, 9h: o mesmo relatório em PDF no e-mail de cada dono.
    weeklySendWindow()
      ? sendWeeklyEmails().catch(() => ({ checked: 0, sent: 0, failed: 1 }))
      : { checked: 0, sent: 0, failed: 0 },
    // Customers waiting and a disconnected WhatsApp reach the owner.
    checkAssistantHealth().catch(() => "failed"),
  ]);
  return Response.json({
    ...customers,
    professionals,
    emails,
    attendance,
    owners,
    weeklyReports,
    dailyReports,
    platformWeeklyReport,
    weeklyEmails,
    assistantHealth,
  });
}
