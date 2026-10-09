import type { Store } from "@/types";
import { onlineBookingEnabled } from "./online-booking";
/** Only destinations backed by saved business data are offered for sharing. */
export function bookingChannelLinks(store: Store, origin: string) {
  const digits = (
    store.whatsappLink?.status === "open"
      ? store.whatsappLink.phone
      : store.business.phone || ""
  ).replace(/\D/g, "");
  const phone =
    digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  const whatsapp = /^\d{10,15}$/.test(phone)
    ? `https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Quero marcar um horário na ${store.business.name}.`)}`
    : "";
  return {
    online: onlineBookingEnabled(store.settings)
      ? `${origin}/${store.business.slug}`
      : "",
    whatsapp,
  };
}
