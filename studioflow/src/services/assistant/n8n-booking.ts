import { createHash } from "node:crypto";
import { z } from "zod";
import type { Appointment, Store } from "@/types";

const entry = z
  .object({
    businessId: z.string().uuid(),
    professionalId: z.string().uuid().nullable(),
    basicUser: z.string().min(1).max(100),
    basicPassword: z.string().min(1).max(256),
    token: z.string().min(32).max(256),
  })
  .strict();
export type BookingWebhookConfig = z.infer<typeof entry>;
export const bookingWebhookUrl =
  "https://n8n.studioflowapp.tech/webhook/studioflow-confirmacao";

export function bookingWebhookConfiguration(
  businessId: string,
  professionalId: string,
  raw = process.env.N8N_BOOKING_EVENTS,
) {
  const entries = z
    .array(entry)
    .max(20)
    .parse(JSON.parse(raw || "[]"));
  const matches = entries.filter(
    (c) =>
      c.businessId === businessId &&
      (c.professionalId === null || c.professionalId === professionalId),
  );
  if (matches.length > 1) throw new Error("booking-webhook-duplicate-scope");
  return matches[0] || null;
}

/** Only persisted, confirmed appointments; no customer contact or booking access token. */
export function bookingCreatedEvent(store: Store, appointment: Appointment) {
  if (
    appointment.businessId !== store.business.id ||
    appointment.status !== "confirmed"
  )
    return null;
  const start = new Date(appointment.start);
  const end = new Date(appointment.end);
  if (!Number.isFinite(start.getTime()) || !(end > start))
    throw new Error("booking-webhook-invalid-time");
  const services = appointment.serviceIds.map((id) =>
    store.services.find((s) => s.id === id),
  );
  if (
    !services.length ||
    services.some((s) => !s || s.businessId !== store.business.id)
  )
    throw new Error("booking-webhook-invalid-service");
  return {
    version: 1,
    event: "STUDIOFLOW_BOOKING_CREATED",
    eventId: createHash("sha256")
      .update(`booking-created:${appointment.businessId}:${appointment.id}`)
      .digest("hex"),
    test: false,
    businessId: appointment.businessId,
    bookingId: appointment.id,
    customerId: appointment.customerId,
    professionalId: appointment.professionalId,
    service: services.map((s) => s!.name).join(" + "),
    appointmentDate: start.toISOString(),
    appointmentTime: new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    }).format(start),
    durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
    price: appointment.price,
    status: "confirmed",
    timezone: "America/Sao_Paulo",
  };
}

export async function sendBookingCreated(
  event: NonNullable<ReturnType<typeof bookingCreatedEvent>>,
  config: BookingWebhookConfig,
  transport: typeof fetch = fetch,
) {
  if (
    event.businessId !== config.businessId ||
    (config.professionalId !== null &&
      event.professionalId !== config.professionalId)
  )
    throw new Error("booking-webhook-scope-mismatch");
  try {
    const response = await transport(bookingWebhookUrl, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${config.basicUser}:${config.basicPassword}`).toString("base64")}`,
        "x-studioflow-n8n-token": config.token,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("rejected");
    const reply = z
      .object({
        received: z.literal(true),
        bookingId: z.string(),
        eventId: z.string(),
      })
      .parse(await response.json());
    if (reply.bookingId !== event.bookingId || reply.eventId !== event.eventId)
      throw new Error("mismatch");
  } catch {
    throw new Error("booking-webhook-unconfirmed");
  }
}
