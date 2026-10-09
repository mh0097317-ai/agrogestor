import { DomainError } from "./availability";

/** Missing in older local snapshots: existing establishments keep online booking. */
export function onlineBookingEnabled(settings: {
  onlineBookingEnabled?: boolean;
}) {
  return (settings.onlineBookingEnabled ?? true) === true;
}

export const onlineBookingUnavailable =
  "Agendamento online indisponível no momento. Entre em contato diretamente com o estabelecimento para realizar seu agendamento.";

export function assertOnlineBookingEnabled(settings: {
  onlineBookingEnabled?: boolean;
}) {
  if (!onlineBookingEnabled(settings))
    throw new DomainError(onlineBookingUnavailable, 403);
}

/** Selected by trusted server adapters, never by the customer's request body. */
export type BookingChannel = "public_link" | "receptionist";

/** Only a configured, valid Brazilian contact becomes a WhatsApp link. */
export function businessWhatsAppLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const national = digits.replace(/^55(?=\d{10,11}$)/, "");
  return /^[1-9][0-9](9[0-9]{8}|[2-5][0-9]{7})$/.test(national)
    ? `https://wa.me/55${national}`
    : null;
}
