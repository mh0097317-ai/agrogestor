import type { Store } from "@/types";
import { money } from "@/lib/utils";
import { availabilityReply } from "./availability-reply";
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
  if (interpretation.intent === "BOOK" && interpretation.nextAction === "ASK") {
    const questions: Record<string, string> = {
      service: "Qual serviço você quer agendar?",
      professional: "Você tem preferência por algum profissional?",
      date: "Qual dia você prefere?",
      time: "Qual horário você prefere?",
      name: "Qual nome você prefere para o agendamento?",
      confirmation: "Posso confirmar esse serviço no dia e horário escolhido?",
    };
    return {
      reply:
        questions[interpretation.missing[0]] ||
        "Qual dia e horário você prefere?",
      handoff: false,
    };
  }
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
    store.services.find(
      (service) =>
        service.id === id &&
        service.businessId === store.business.id &&
        service.active,
    ),
  );
  if (services.some((service) => !service))
    throw new Error("n8n-reply-service-scope");
  if (interpretation.intent === "PRICE" && services.length) {
    const offer = availabilityReply(
      { ...interpretation, intent: "AVAILABILITY", nextAction: "CONSULT" },
      store,
      customerText,
      [],
      now,
    );
    return {
      reply: `${services.map((service) => `${service!.name.charAt(0).toUpperCase()}${service!.name.slice(1).toLowerCase()} fica ${money(service!.price)}`).join(". ")}.\n\n${offer || "Qual dia fica melhor para você?"}`,
      handoff: false,
    };
  }
  if (
    interpretation.intent === "AVAILABILITY" &&
    services.length &&
    /^\d{4}-\d{2}-\d{2}$/.test(interpretation.date)
  ) {
    const offer = availabilityReply(
      { ...interpretation, nextAction: "CONSULT" },
      store,
      customerText,
      [],
      now,
    );
    return {
      reply:
        offer ||
        "Vamos conferir a disponibilidade. Qual profissional você prefere?",
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
