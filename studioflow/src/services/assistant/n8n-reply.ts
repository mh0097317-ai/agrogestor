import type { Store } from "@/types";
import { availableSlots } from "@/lib/availability";
import { matchesTimePeriod, requestedTimePeriod } from "@/lib/time-period";
import { money } from "@/lib/utils";
import type { Interpretation } from "./understanding";
import {
  unverifiedAvailabilityClaim,
  unverifiedBookingClaim,
} from "./reply-validation";

/** Commercial facts come from a fresh scoped store, never from proposed prose. */
export function verifiedN8nReply(
  output: string,
  interpretation: Interpretation,
  store: Store,
  customerText: string,
  now = new Date(),
) {
  if (unverifiedBookingClaim(output))
    throw new Error("n8n-reply-booking-claim");
  if (
    ["BOOK", "CHANGE_BOOKING"].includes(interpretation.intent) ||
    interpretation.nextAction === "CONFIRM" ||
    interpretation.nextAction === "HANDOFF"
  )
    return {
      reply: "Vou chamar alguém da equipe para concluir esse pedido com você.",
      handoff: true,
    };
  const services = interpretation.serviceIds.map((id) =>
    store.services.find((service) => service.id === id && service.active),
  );
  if (services.some((service) => !service))
    throw new Error("n8n-reply-service-scope");
  if (interpretation.intent === "PRICE" && services.length) {
    return {
      reply: `${services.map((service) => `${service!.name}: ${money(service!.price)}`).join("; ")}. Qual dia você prefere?`,
      handoff: false,
    };
  }
  if (
    interpretation.intent === "AVAILABILITY" &&
    services.length &&
    /^\d{4}-\d{2}-\d{2}$/.test(interpretation.date)
  ) {
    const slots = availableSlots(
      store,
      interpretation.serviceIds,
      interpretation.professionalId || "any",
      interpretation.date,
      now,
    )
      .filter((slot) =>
        matchesTimePeriod(slot.time, requestedTimePeriod(customerText)),
      )
      .slice(0, 3);
    const date = interpretation.date.split("-").reverse().join("/");
    return {
      reply: slots.length
        ? `Para ${date}, encontrei ${slots.map((slot) => `${slot.time} com ${store.professionals.find((p) => p.id === slot.professionalId)!.name}`).join("; ")}. Qual você prefere? A reserva ainda não foi feita.`
        : `Não encontrei horários livres para esse pedido em ${date}. Você prefere outro dia?`,
      handoff: false,
    };
  }
  // Without structured query parameters we cannot verify a proposed slot/price.
  if (
    unverifiedAvailabilityClaim(output, false) ||
    /\b\d{1,2}(?::\d{2}|h\b)|R\$|\breais\b/i.test(output)
  )
    throw new Error("n8n-reply-unverified-facts");
  if (output.length > 900) throw new Error("n8n-reply-too-long");
  return { reply: output.replace(/\\n/g, "\n"), handoff: false };
}
