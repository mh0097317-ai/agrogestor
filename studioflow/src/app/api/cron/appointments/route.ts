import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requestOrigin } from "@/services/server-http";
import {
  sendAppointmentReminders,
  recoverProfessionalBookingNotices,
} from "@/services/whatsapp/reminders";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
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
  const [customers, professionals] = await Promise.all([
    sendAppointmentReminders(),
    recoverProfessionalBookingNotices(requestOrigin(request)),
  ]);
  return Response.json({ ...customers, professionals });
}
