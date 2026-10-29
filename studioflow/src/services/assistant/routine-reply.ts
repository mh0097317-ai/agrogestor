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
  const value = normalize(text).replace(
    /^(?:oi|ola|bom dia|boa tarde|boa noite)[,!.\s]+/,
    "",
  );
  const match =
    /^(?:qual (?:e )?o (?:valor|preco) (?:do|da|de)|quanto (?:que )?(?:custa|fica|ta|esta|e)(?: o| a)?) (.+?)[?!.\s]*$/.exec(
      value,
    ) ||
    /^(?:o |a )?(.+?) (?:e|fica|custa|ta|esta) quanto[?!.\s]*$/.exec(value);
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
    const price = `${services.map((s) => `${s!.name.charAt(0).toUpperCase()}${s!.name.slice(1).toLowerCase()} fica ${money(s!.price)}`).join("; ")}.`;
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
    return `${price}\n\n${offer || "Qual dia fica melhor para você?"}`;
  }
  if (
    selection.nextAction === "ASK" &&
    selection.missing.length === 1 &&
    ["BOOK", "AVAILABILITY", "CONTINUE"].includes(selection.intent)
  ) {
    const question: Record<string, string> = {
      service: "Me conta, qual serviço você gostaria de fazer?",
      name: "Como posso te chamar para deixar o agendamento no seu nome?",
      date: "Qual dia fica melhor para você?",
      time: "E qual horário fica melhor para você?",
      professional: "Você prefere algum profissional ou posso buscar as opções da equipe?",
    };
    return question[selection.missing[0]] || null;
  }
  return null;
}
