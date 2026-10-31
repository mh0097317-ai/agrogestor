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
  now = new Date(),
) {
  const zone = { timeZone: "America/Sao_Paulo" } as const;
  const time = new Intl.DateTimeFormat("pt-BR", {
    ...zone,
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
  const date = (value: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("pt-BR", { ...zone, ...options }).format(value);
  const start = new Date(appointment.start);
  const day = date(start, { day: "2-digit", month: "2-digit" });
  const iso = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", zone).format(value);
  const today = iso(now) === iso(start);
  const tomorrow = iso(new Date(now.getTime() + 86_400_000)) === iso(start);
  const when = today
    ? `hoje, ${day}`
    : tomorrow
      ? `amanhã, ${day}`
      : `${date(start, { weekday: "long" })}, ${day}`;
  const name = firstName(appointment.customerName);
  const what = service ? displayName(service).toLowerCase() : "horário";
  const withWho = professional ? ` com ${displayName(professional.name)}` : "";
  // Three different notes, short like a person writes, never the same template.
  if (minutes === 720)
    return `Oi, ${name || "tudo bem"}! Passando pra lembrar do seu ${what}${withWho} ${when}, às ${time}, aqui na ${store.business.name}. Se precisar mudar, é só me chamar por aqui.`;
  if (minutes === 60)
    return `${name ? `${name}, falta` : "Falta"} 1 hora pro seu ${what}${withWho}: ${when}, às ${time}. Até já!`;
  return `Oi, ${name || "tudo bem"}! Daqui a 2 horas é o seu ${what}${withWho} na ${store.business.name}: ${when}, às ${time}. Te esperamos!`;
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
          )) || (await conversationSender(row.business_id, null, "assistant"));
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
