import type { ConversationMessage, Store } from "@/types";
import { hasBusinessSubject } from "./understanding";
import { menuSelection } from "./booking-menu";

const greeting =
  /^(?:oi+|ol[aá]|opa|e a[ií]|eae|bom dia|boa tarde|boa noite|tudo bem\??)[!.,\s]*(?:tudo bem\??)?[!.\s]*$/i;
const welcomeRows =
  /^Quero (?:agendar um horário|ver serviços e preços|falar com a equipe)$/;

/**
 * The shop WhatsApp is often someone's personal phone. The assistant answers
 * customers and business subjects, not the owner's family or suppliers:
 * - a registered customer;
 * - a list tap or a message about the business (service, horário, preço…);
 * - a reply within 30 minutes of the assistant's own last message;
 * - a first "oi" from a contact nobody on the team has ever written to.
 */
export async function assistantMayAnswer(input: {
  text: string;
  /** Loaded only when the cheap checks did not decide. */
  store: () => Promise<Store>;
  messages: ConversationMessage[];
  isCustomer: boolean;
  now?: Date;
}) {
  const text = input.text.trim();
  const now = (input.now || new Date()).getTime();
  if (input.isCustomer) return true;
  if (/^SF_[A-Z_]+\|/.test(text) || welcomeRows.test(text)) return true;
  const lastAssistant = input.messages.findLast((m) => m.role === "assistant");
  if (lastAssistant && now - Date.parse(lastAssistant.createdAt) <= 30 * 60_000)
    return true;
  if (greeting.test(text) && !input.messages.some((m) => m.role === "staff"))
    return true;
  const plain = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (
    /\b(?:quanto (?:custa|e|fica|sai|ta|esta)|marcar|marca um|atende|atendem|tem vaga)\b/.test(
      plain,
    )
  )
    return true;
  const store = await input.store();
  return !!menuSelection(store, text) || hasBusinessSubject(text, store);
}
