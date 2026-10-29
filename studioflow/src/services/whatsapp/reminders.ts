import { createSupabaseAdmin } from "@/lib/supabase/server";
import { displayName, firstName } from "@/lib/person-name";
import { readBusinessAccess } from "@/lib/supabase/server";
import { accessOpen } from "@/lib/access";
import { getPublicStore } from "../server-store";
import { conversationSender } from "./link";
import { notifyNewBooking } from "./notify";
import type { Appointment, Store } from "@/types";

export function customerReminder(
  store: Store,
  appointment: Appointment,
  minutes = 120,
) {
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(appointment.start));
  const service = appointment.serviceIds
    .map((id) => store.services.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(" + ");
  const professional = store.professionals.find(
    (p) => p.id === appointment.professionalId,
  );
  const day = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(appointment.start));
  const lead =
    minutes === 720
      ? "Faltam cerca de 12 horas"
      : minutes === 60
        ? "Falta cerca de 1 hora"
        : "Faltam cerca de 2 horas";
  return `Oi, ${firstName(appointment.customerName) || "tudo bem"}! ${lead} para seu horário na ${store.business.name}.\n\n${service ? `${displayName(service)} · ` : ""}${day} às ${time}${professional ? ` com ${displayName(professional.name)}` : ""}. Se precisar ajustar, fale com a equipe por aqui. Até lá!`;
}

/** No AI calls. Atomic claims prevent repeated sends, even with concurrent jobs. */
export async function sendAppointmentReminders() {
  const admin = createSupabaseAdmin();
  const { data, error } = (await admin.rpc(
    "due_staged_appointment_reminders",
  )) as {
    data:
      | {
          id: string;
          business_id: string;
          start: string;
          step_minutes: number;
        }[]
      | null;
    error: unknown;
  };
  if (error) throw new Error("reminder query failed");
  const report = { checked: data?.length || 0, sent: 0, failed: 0 };
  await Promise.all(
    (data || []).map(async (row) => {
      try {
        if (!accessOpen(await readBusinessAccess(row.business_id))) return;
        const { data: business } = await admin
          .from("businesses")
          .select("slug")
          .eq("id", row.business_id)
          .single();
        if (!business) return;
        const store = await getPublicStore(business.slug);
        const appointment = store.appointments.find(
          (a) =>
            a.id === row.id &&
            new Date(a.start).getTime() === new Date(row.start).getTime(),
        );
        if (
          !appointment ||
          !store.settings.notifications ||
          appointment.status !== "confirmed"
        )
          return;
        const send =
          // Automatic: recorded as the assistant, so it never reads as a
          // person taking over the chat.
          (await conversationSender(
            row.business_id,
            appointment.professionalId,
            "assistant",
          )) ||
          (await conversationSender(row.business_id, null, "assistant"));
        if (!send) return;
        const { data: claimed, error: claimError } = await admin.rpc(
          "claim_staged_appointment_reminder",
          { p_id: row.id, p_minutes: row.step_minutes, p_start: row.start },
        );
        if (claimError) throw new Error("reminder claim failed");
        if (!claimed) return;
        try {
          await send(
            appointment.customerPhone,
            customerReminder(store, appointment, row.step_minutes),
          );
          const { error: updateError } = await admin
            .from("appointment_reminder_steps")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("appointment_id", row.id)
            .eq("step_minutes", row.step_minutes)
            .eq("appointment_start", row.start);
          if (updateError) throw new Error("reminder receipt failed");
          if (row.step_minutes === 120)
            await admin
              .from("appointment_whatsapp_notices")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("appointment_id", row.id)
              .eq("kind", "customer_reminder")
              .eq("appointment_start", row.start);
          report.sent++;
        } catch {
          await admin
            .from("appointment_reminder_steps")
            .update({ status: "failed" })
            .eq("appointment_id", row.id)
            .eq("step_minutes", row.step_minutes)
            .eq("appointment_start", row.start);
          report.failed++;
        }
      } catch {
        report.failed++;
      }
    }),
  );
  return report;
}

/** Independent of browser and AI: picks up recent bookings that had no sender yet. */
export async function recoverProfessionalBookingNotices(origin: string) {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc("due_professional_booking_notices");
  if (error) throw new Error("professional notice query failed");
  const report = { checked: data?.length || 0, sent: 0, skipped: 0, failed: 0 };
  await Promise.all(
    (data || []).map(async (row: { id: string; slug: string }) => {
      const result = await notifyNewBooking(row.slug, row.id, origin);
      report[result]++;
    }),
  );
  return report;
}
