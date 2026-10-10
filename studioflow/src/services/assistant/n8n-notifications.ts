import { z } from "zod";
import { appUrl } from "@/lib/app-url";
import { createSupabaseAdmin, readBusinessAccess } from "@/lib/supabase/server";
import { accessOpen } from "@/lib/access";
import { DomainError } from "@/lib/availability";
import type { Appointment } from "@/types";
import { getPublicStore } from "../server-store";
import { conversationSender } from "../whatsapp/link";
import type { N8nIntegration } from "./n8n-consultation";
import { bookingWebhookConfiguration } from "./n8n-booking";
import {
  appointmentAction,
  appointmentNotificationOptions,
  appointmentNotificationSchema,
} from "./n8n-appointment-policy";
import {
  appointmentCandidates,
  notifyAppointment,
} from "./n8n-appointment-notifications";

export const notificationSchema = z.discriminatedUnion("action", [
  ...appointmentNotificationOptions,
  z
    .object({
      action: z.literal("inactive_customer"),
      customerId: z.string().uuid(),
      test: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      action: z.literal("abandoned_conversation"),
      conversationId: z.string().uuid(),
      test: z.boolean().default(false),
    })
    .strict(),
]);

export const notificationAction = z.enum([
  ...appointmentAction.options,
  "inactive_customer",
  "abandoned_conversation",
]);

export async function notificationCandidates(
  action: z.infer<typeof notificationAction>,
  integration: N8nIntegration,
) {
  const professionalId = integration.professionalId;
  if (
    !professionalId ||
    !bookingWebhookConfiguration(integration.businessId, professionalId)
  )
    throw new DomainError("Automações não habilitadas neste escopo.", 403);
  if (!accessOpen(await readBusinessAccess(integration.businessId)))
    throw new DomainError("Estabelecimento indisponível.", 403);
  const store = await getPublicStore(integration.slug);
  if (store.business.id !== integration.businessId)
    throw new DomainError("Escopo inválido.", 403);
  if (
    action === "daily_summary"
      ? !store.settings.notifyProfessionals
      : !store.settings.notifications
  )
    return { candidates: [] };
  const appointmentType = appointmentAction.safeParse(action);
  if (appointmentType.success)
    return appointmentCandidates(appointmentType.data, integration);
  const admin = createSupabaseAdmin();
  const { data: receipts, error: receiptError } = await admin
    .from("n8n_notification_receipts")
    .select("target_id,episode")
    .eq("business_id", integration.businessId)
    .eq("professional_id", professionalId)
    .eq("kind", action);
  if (receiptError)
    throw new DomainError("Não foi possível conferir os envios.", 503);
  const attempted = (id: string, episode: string) =>
    receipts?.some(
      (r) =>
        r.target_id === id && Date.parse(r.episode) === Date.parse(episode),
    );
  if (action === "inactive_customer") {
    return {
      candidates: store.customers
        .flatMap((c) => {
          const episode = inactiveCustomerEpisode(
            store.appointments,
            c.id,
            professionalId,
          );
          return episode && !attempted(c.id, episode)
            ? [{ id_cliente: c.id, ultimo_agendamento: episode, ativo: true }]
            : [];
        })
        .slice(0, 100),
    };
  }
  const now = Date.now();
  const { data, error } = await admin
    .from("conversations")
    .select("id,last_message_at")
    .eq("business_id", integration.businessId)
    .eq("whatsapp_professional_id", professionalId)
    .eq("channel", "whatsapp")
    .eq("status", "ai")
    .lte("last_message_at", new Date(now - 86_400_000).toISOString())
    .gte("last_message_at", new Date(now - 7 * 86_400_000).toISOString())
    .order("last_message_at")
    .limit(1000);
  if (error)
    throw new DomainError("Não foi possível consultar as conversas.", 503);
  return {
    candidates: (data || [])
      .filter((c) => !attempted(c.id, c.last_message_at))
      .slice(0, 100)
      .map((c) => ({
        id_sessao: c.id,
        ultima_interacao: c.last_message_at,
        recuperado: false,
      })),
  };
}

export function inactiveCustomerEpisode(
  appointments: Appointment[],
  customerId: string,
  professionalId: string,
  now = Date.now(),
) {
  const customer = appointments.filter((a) => a.customerId === customerId);
  if (
    customer.some(
      (a) =>
        ["confirmed", "pending", "in_progress"].includes(a.status) &&
        new Date(a.end).getTime() >= now,
    )
  )
    return null;
  const last = customer
    .filter(
      (a) => a.status === "completed" && a.professionalId === professionalId,
    )
    .sort((a, b) => b.start.localeCompare(a.start))[0];
  return last && now - new Date(last.end).getTime() >= 30 * 86_400_000
    ? last.end
    : null;
}

/** Resolve contacts in the backend; the workflow cannot supply a phone or message. */
export async function notifyN8nCustomer(
  input: z.infer<typeof notificationSchema>,
  integration: N8nIntegration,
) {
  const professionalId = integration.professionalId;
  if (
    !professionalId ||
    !bookingWebhookConfiguration(integration.businessId, professionalId)
  )
    throw new DomainError("Automações não habilitadas neste escopo.", 403);
  if (!accessOpen(await readBusinessAccess(integration.businessId)))
    throw new DomainError("Estabelecimento indisponível.", 403);
  const store = await getPublicStore(integration.slug);
  if (store.business.id !== integration.businessId)
    throw new DomainError("Escopo inválido.", 403);
  const skipped = (reason: string) => ({ sent: false, skipped: true, reason });
  if (input.action !== "daily_summary" && !store.settings.notifications)
    return skipped("notifications_disabled");
  const appointmentInput = appointmentNotificationSchema.safeParse(input);
  if (appointmentInput.success)
    return notifyAppointment(appointmentInput.data, integration, store);
  if (
    input.action !== "inactive_customer" &&
    input.action !== "abandoned_conversation"
  )
    throw new DomainError("Ação inválida.", 400);
  const admin = createSupabaseAdmin();
  let phone = "",
    name = "",
    episode: string | null = null;
  const targetId =
    input.action === "inactive_customer"
      ? input.customerId
      : input.conversationId;
  if (input.action === "inactive_customer") {
    const customer = store.customers.find(
      (c) =>
        c.id === input.customerId && c.businessId === integration.businessId,
    );
    if (!customer) return skipped("customer_not_found");
    episode = inactiveCustomerEpisode(
      store.appointments,
      customer.id,
      professionalId,
    );
    phone = customer.phone;
    name = customer.name;
  } else {
    const { data: conversation, error } = await admin
      .from("conversations")
      .select("contact_phone,contact_name,status,last_message_at")
      .eq("business_id", integration.businessId)
      .eq("whatsapp_professional_id", professionalId)
      .eq("channel", "whatsapp")
      .eq("id", input.conversationId)
      .maybeSingle();
    if (error)
      throw new DomainError("Não foi possível verificar a conversa.", 503);
    if (!conversation || conversation.status !== "ai")
      return skipped("conversation_not_eligible");
    const at = Date.parse(conversation.last_message_at);
    const age = Date.now() - at;
    if (!Number.isFinite(at) || age < 86_400_000 || age > 7 * 86_400_000)
      return skipped("conversation_not_eligible");
    phone = conversation.contact_phone;
    name = conversation.contact_name;
    if (
      store.appointments.some(
        (a) =>
          a.customerPhone.replace(/\D/g, "") === phone.replace(/\D/g, "") &&
          !["cancelled", "no_show"].includes(a.status) &&
          new Date(a.start).getTime() >= at,
      )
    )
      return skipped("already_booked");
    episode = new Date(at).toISOString();
  }
  if (!episode || !phone) return skipped("not_due");
  const send = await conversationSender(
    integration.businessId,
    professionalId,
    "assistant",
  );
  if (!send) return skipped("whatsapp_disconnected");
  if (input.test)
    return { sent: false, skipped: false, test: true, eligible: true };
  const key = {
    business_id: integration.businessId,
    professional_id: professionalId,
    kind: input.action,
    target_id: targetId,
    episode,
  };
  const { error: claimError } = await admin
    .from("n8n_notification_receipts")
    .insert(key);
  if (claimError?.code === "23505") return skipped("already_attempted");
  if (claimError)
    throw new DomainError("Não foi possível registrar o envio.", 503);
  const first = name.trim().split(/\s+/)[0]?.slice(0, 50);
  const text =
    input.action === "inactive_customer"
      ? `Oi${first ? `, ${first}` : ""}! Aqui é a assistência virtual da ${store.business.name}. Faz um tempo desde seu último atendimento. Se quiser marcar seu próximo horário: ${appUrl}/${store.business.slug}`
      : `Oi${first ? `, ${first}` : ""}! Aqui é a assistência virtual da ${store.business.name}. Se ainda quiser continuar seu agendamento, veja os serviços e horários aqui: ${appUrl}/${store.business.slug}`;
  const receipt = () =>
    admin
      .from("n8n_notification_receipts")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .match(key);
  try {
    await send(phone, text);
    const { error } = await receipt();
    if (error) throw new Error("receipt failed");
    return { sent: true, skipped: false };
  } catch {
    await admin
      .from("n8n_notification_receipts")
      .update({ status: "failed" })
      .match(key);
    throw new DomainError(
      "Envio não confirmado; não será repetido automaticamente.",
      503,
    );
  }
}
