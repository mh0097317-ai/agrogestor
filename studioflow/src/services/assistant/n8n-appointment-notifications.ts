import { z } from "zod";
import { appUrl } from "@/lib/app-url";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { DomainError } from "@/lib/availability";
import type { Appointment, Store } from "@/types";
import { camel } from "../server-store";
import { conversationSender, readProfessionalLinks } from "../whatsapp/link";
import type { N8nIntegration } from "./n8n-consultation";
import {
  appointmentEligible,
  summaryDue,
  saoPauloDate,
  type AppointmentAction,
  appointmentNotificationSchema,
} from "./n8n-appointment-policy";

async function readAppointments(integration: N8nIntegration, id?: string) {
  const admin = createSupabaseAdmin();
  let query = admin
    .from("appointments")
    .select("*")
    .eq("business_id", integration.businessId)
    .eq("professional_id", integration.professionalId!);
  if (id) query = query.eq("id", id);
  else
    query = query
      .gte("end", new Date(Date.now() - 86400000).toISOString())
      .lte("start", new Date(Date.now() + 86400000).toISOString());
  const { data, error } = await query.order("start").limit(1000);
  if (error) throw new DomainError("Não foi possível verificar a agenda.", 503);
  if (!id && data?.length === 1000)
    throw new DomainError("Agenda excede o limite de processamento.", 503);
  return camel(data || []) as Appointment[];
}

export async function appointmentCandidates(
  action: AppointmentAction,
  integration: N8nIntegration,
) {
  const now = Date.now(),
    date = saoPauloDate(now),
    admin = createSupabaseAdmin();
  const { data: receipts, error } = await admin
    .from("n8n_notification_receipts")
    .select("target_id,episode")
    .eq("business_id", integration.businessId)
    .eq("professional_id", integration.professionalId!)
    .eq("kind", action);
  if (error) throw new DomainError("Não foi possível conferir os envios.", 503);
  if (action === "daily_summary")
    return {
      candidates:
        summaryDue(date, now) &&
        !receipts?.some(
          (r) =>
            r.target_id === integration.professionalId &&
            Date.parse(r.episode) === Date.parse(date + "T03:00:00.000Z"),
        )
          ? [{ date }]
          : [],
    };
  let appointments = (await readAppointments(integration)).filter((a) =>
    appointmentEligible(action, a, now),
  );
  if (action === "reminder_2h") {
    const { data, error } = await admin
      .from("appointment_whatsapp_notices")
      .select("appointment_id,appointment_start")
      .eq("business_id", integration.businessId)
      .eq("kind", "customer_reminder");
    if (error)
      throw new DomainError("Não foi possível conferir os lembretes.", 503);
    appointments = appointments.filter(
      (a) =>
        !data?.some(
          (r) =>
            r.appointment_id === a.id &&
            Date.parse(r.appointment_start) === Date.parse(a.start),
        ),
    );
  }
  return {
    candidates: appointments
      .filter(
        (a) =>
          !receipts?.some(
            (r) =>
              r.target_id === a.id &&
              Date.parse(r.episode) === Date.parse(a.start),
          ),
      )
      .slice(0, 100)
      .map((a) => ({ appointmentId: a.id })),
  };
}

export async function notifyAppointment(
  input: z.infer<typeof appointmentNotificationSchema>,
  integration: N8nIntegration,
  store: Store,
) {
  const skipped = (reason: string) => ({ sent: false, skipped: true, reason });
  const professionalId = integration.professionalId!,
    admin = createSupabaseAdmin(),
    now = Date.now();
  let phone = "",
    text = "",
    targetId = "",
    episode = "";
  let appointment: Appointment | undefined;
  if (input.action === "daily_summary") {
    if (!store.settings.notifyProfessionals)
      return skipped("professional_notifications_disabled");
    if (!summaryDue(input.date, now)) return skipped("not_due");
    const professional = store.professionals.find(
      (p) =>
        p.id === professionalId &&
        p.businessId === integration.businessId &&
        p.active,
    );
    if (!professional) return skipped("professional_not_found");
    phone =
      professional.phone ||
      (
        await readProfessionalLinks(integration.businessId, professionalId)
      ).find((l) => l.status === "open")?.phone ||
      "";
    const appointments = (await readAppointments(integration)).filter(
      (a) => saoPauloDate(Date.parse(a.start)) === input.date,
    );
    const count = (status: string) =>
      appointments.filter((a) => a.status === status).length;
    text = `Resumo de ${input.date} — ${store.business.name}\nConcluídos: ${count("completed")}\nNão compareceram: ${count("no_show")}\nCancelados: ${count("cancelled")}\nConfirmados: ${count("confirmed")}\nPendentes: ${count("pending")}`;
    targetId = professionalId;
    episode = input.date + "T03:00:00.000Z";
  } else {
    appointment = (await readAppointments(integration, input.appointmentId))[0];
    if (!appointment || !appointmentEligible(input.action, appointment, now))
      return skipped("appointment_not_eligible");
    phone = appointment.customerPhone;
    const first =
      appointment.customerName.trim().split(/\s+/)[0]?.slice(0, 50) || "";
    const time = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(appointment.start));
    const link = `${appUrl}/${store.business.slug}/agendar`;
    text =
      input.action === "no_show_followup"
        ? `Oi${first ? `, ${first}` : ""}! Aqui é a assistência virtual da ${store.business.name}. Seu atendimento foi registrado como não comparecimento. Se houve algum engano, responda por aqui. Para marcar outro horário: ${link}`
        : input.action === "post_appointment"
          ? `Oi${first ? `, ${first}` : ""}! Aqui é a assistência virtual da ${store.business.name}. Obrigado pela visita! Como foi seu atendimento? Pode responder por aqui.`
          : `Oi${first ? `, ${first}` : ""}! Aqui é a assistência virtual da ${store.business.name}. Lembrando do seu horário em ${time}. Se precisar falar com a equipe, responda por aqui.`;
    targetId = appointment.id;
    episode = appointment.start;
  }
  if (!phone) return skipped("recipient_missing");
  const send = await conversationSender(
    integration.businessId,
    professionalId,
    input.action === "daily_summary" ? "staff" : "assistant",
  );
  if (!send) return skipped("whatsapp_disconnected");
  if (input.test)
    return { sent: false, test: true, eligible: true, skipped: false };
  const key = {
    business_id: integration.businessId,
    professional_id: professionalId,
    kind: input.action,
    target_id: targetId,
    episode,
  };
  const shared = input.action === "reminder_2h" && appointment;
  if (shared) {
    const { data, error } = await admin.rpc("claim_appointment_notice", {
      p_id: shared.id,
      p_kind: "customer_reminder",
      p_start: shared.start,
    });
    if (error)
      throw new DomainError("Não foi possível registrar o lembrete.", 503);
    if (!data) return skipped("already_attempted");
  } else {
    const { error } = await admin.from("n8n_notification_receipts").insert(key);
    if (error?.code === "23505") return skipped("already_attempted");
    if (error)
      throw new DomainError("Não foi possível registrar o envio.", 503);
  }
  const receipt = (status: string) =>
    shared
      ? admin
          .from("appointment_whatsapp_notices")
          .update({
            status,
            ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
          })
          .eq("appointment_id", shared.id)
          .eq("kind", "customer_reminder")
          .eq("appointment_start", shared.start)
      : admin
          .from("n8n_notification_receipts")
          .update({
            status,
            ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
          })
          .match(key);
  try {
    await send(phone, text);
    const { error } = await receipt("sent");
    if (error) throw new Error("receipt failed");
    return { sent: true, skipped: false };
  } catch {
    await receipt("failed");
    throw new DomainError(
      "Envio não confirmado; não será repetido automaticamente.",
      503,
    );
  }
}
