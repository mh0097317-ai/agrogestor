import type { Appointment, Store } from "@/types";
import { money } from "@/lib/utils";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getPublicStore } from "../server-store";
import { isDemo, mutateDemo } from "../server-demo";
import { conversationSender, demoOutbox, type Sender } from "./link";

export function customerBookingMessage(store: Store, a: Appointment) {
  const when = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(a.start));
  const services = a.serviceIds
    .map((id) => store.services.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(" + ");
  const professional = store.professionals.find(
    (p) => p.id === a.professionalId,
  )?.name;
  const state =
    a.depositStatus === "pending"
      ? `Horário reservado, aguardando o sinal de ${money(Number(a.depositAmount))} pelo Pix.`
      : a.status === "pending"
        ? "Pedido recebido, aguardando aprovação da equipe."
        : "Agendamento confirmado!";
  return [
    `Oi, ${a.customerName.trim().split(/\s+/)[0]}! ${state}`,
    `${services || "Atendimento"} na ${store.business.name}.`,
    `${when}${professional ? ` com ${professional}` : ""}.`,
    `Valor: ${money(a.price)}.`,
    "Se precisar falar com a equipe, responda por aqui.",
  ].join("\n");
}

export function customerBookingEligible(
  store: Store,
  a: Appointment,
  now = Date.now(),
) {
  return (
    a.businessId === store.business.id &&
    store.settings.notifications &&
    ["confirmed", "pending"].includes(a.status) &&
    Date.parse(a.start) > now &&
    a.bookingChannel !== "assistant_whatsapp" &&
    /^\d{10,15}$/.test(a.customerPhone.replace(/\D/g, ""))
  );
}

type Journal = {
  sender: Sender | null;
  claim: () => Promise<boolean>;
  receipt: (status: "sent" | "failed", providerId?: string) => Promise<void>;
};
/** A provider acknowledgement is an accepted send, not proof the phone read it. */
export async function deliverCustomerBooking(
  store: Store,
  a: Appointment,
  journal: Journal,
) {
  if (!customerBookingEligible(store, a) || !journal.sender)
    return "skipped" as const;
  if (!(await journal.claim())) return "skipped" as const;
  try {
    const id = await journal.sender(
      a.customerPhone,
      customerBookingMessage(store, a),
    );
    if (typeof id !== "string" || !id.trim())
      throw Error("provider acknowledgement missing");
    await journal.receipt("sent", id);
    return "sent" as const;
  } catch {
    await journal.receipt("failed").catch(() => undefined);
    return "failed" as const;
  }
}

export async function notifyCustomerBooking(
  slug: string,
  appointmentId: string,
) {
  try {
    if (isDemo())
      return await mutateDemo((store) => {
        const a = store.appointments.find((a) => a.id === appointmentId);
        if (!a || !customerBookingEligible(store, a)) return "skipped" as const;
        if (
          store.outbox?.some(
            (row) => row.kind === `cliente-agendamento:${a.id}`,
          )
        )
          return "skipped" as const;
        demoOutbox(
          store,
          a.customerPhone,
          customerBookingMessage(store, a),
          `cliente-agendamento:${a.id}`,
        );
        return "sent" as const;
      }, slug);
    const store = await getPublicStore(slug);
    const a = store.appointments.find((a) => a.id === appointmentId);
    if (!a || !customerBookingEligible(store, a)) return "skipped" as const;
    const admin = createSupabaseAdmin();
    return await deliverCustomerBooking(store, a, {
      sender:
        (await conversationSender(
          store.business.id,
          a.professionalId,
          "assistant",
        )) || (await conversationSender(store.business.id, null, "assistant")),
      claim: async () => {
        const { data, error } = await admin.rpc("claim_appointment_notice", {
          p_id: a.id,
          p_kind: "customer_booking",
          p_start: a.start,
        });
        if (error) throw Error("customer booking claim failed");
        return data === true;
      },
      receipt: async (status, providerId) => {
        const { error } = await admin
          .from("appointment_whatsapp_notices")
          .update({
            status,
            ...(status === "sent"
              ? {
                  sent_at: new Date().toISOString(),
                  provider_message_id: providerId || null,
                }
              : {}),
          })
          .eq("appointment_id", a.id)
          .eq("kind", "customer_booking")
          .eq("appointment_start", a.start);
        if (error) throw Error("customer booking receipt failed");
      },
    });
  } catch {
    console.error("StudioFlow customer booking notice unconfirmed", {
      appointmentId,
    });
    return "failed" as const;
  }
}
