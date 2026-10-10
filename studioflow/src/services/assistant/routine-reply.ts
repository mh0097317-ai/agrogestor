import { money } from "@/lib/utils";
import type { Store, ConversationMessage } from "@/types";
import type { Interpretation } from "./understanding";
import { availabilityReply } from "./availability-reply";

/** Exact catalog-only question: mixed topics/instructions must still be interpreted. */
export function exactPriceSelection(
  text: string,
  store: Store,
): Interpretation | null {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const match =
    /^(?:qual (?:e )?o (?:valor|preco) (?:do|da|de)|quanto (?:custa|fica|ta|esta)(?: o| a)?) (.+?)[?!.\s]*$/.exec(
      normalize(text),
    );
  const services = match
    ? store.services.filter(
        (s) =>
          s.businessId === store.business.id &&
          s.active &&
          normalize(s.name) === match[1],
      )
    : [];
  if (services.length !== 1) return null;
  return {
    intent: "PRICE",
    stage: "QUALIFYING",
    confidence: 1,
    serviceIds: [services[0].id],
    professionalId: "",
    date: "",
    time: "",
    missing: [],
    nextAction: "ANSWER",
  };
}

/** Safe answers after classification need neither an external turn nor tools. */
export function routineReply(
  selection: Interpretation,
  store: Store,
  context: { text?: string; recent?: ConversationMessage[]; now?: Date } = {},
): string | null {
  if (selection.confidence < 0.9) return null;
  if (
    selection.intent === "PRICE" &&
    selection.nextAction === "ANSWER" &&
    selection.serviceIds.length
  ) {
    const services = selection.serviceIds.map((id) =>
      store.services.find(
        (s) => s.id === id && s.businessId === store.business.id && s.active,
      ),
    );
    if (services.some((s) => !s)) return null;
    const price = `${services.map((s) => `${s!.name}: ${money(s!.price)}`).join("; ")}.`;
    const repeated = context.recent?.some(
      (m) =>
        m.role === "assistant" &&
        m.body.includes(price) &&
        (context.now || new Date()).getTime() - Date.parse(m.createdAt) <=
          30 * 60_000,
    );
    const hasCurrentDate =
      !selection.date &&
      context.recent?.some(
        (m) =>
          ["customer", "assistant"].includes(m.role) &&
          (context.now || new Date()).getTime() - Date.parse(m.createdAt) <=
            30 * 60_000 &&
          /\b(?:hoje|amanh[aã]|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)\b|\d{2}\/\d{2}|\d{4}-\d{2}-\d{2}/i.test(
            m.body,
          ),
      );
    if (repeated || hasCurrentDate) return price;
    const offer = availabilityReply(
      { ...selection, intent: "AVAILABILITY", nextAction: "CONSULT" },
      store,
      context.text || "",
      context.recent || [],
      context.now,
    );
    return `${price} ${offer || "Qual dia você prefere?"}`;
  }
  if (
    selection.nextAction === "ASK" &&
    selection.missing.length === 1 &&
    ["BOOK", "AVAILABILITY", "CONTINUE"].includes(selection.intent)
  ) {
    const question: Record<string, string> = {
      service: "Qual serviço você quer agendar?",
      name: "Qual nome você prefere para o agendamento?",
      date: "Qual dia você prefere?",
      time: "Qual horário você prefere?",
      professional: "Você tem preferência por algum profissional?",
    };
    return question[selection.missing[0]] || null;
  }
  return null;
}
