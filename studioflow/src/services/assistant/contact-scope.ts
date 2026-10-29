import type { ConversationMessage, Store } from "@/types";
import { hasBusinessSubject } from "./understanding";
import { menuSelection } from "./booking-menu";

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const greeting =
  /^(?:oi+|ola|opa|e ai|eae|bom dia|boa tarde|boa noite)(?:[!.,\s]+(?:tudo bem|tudo bom|td bem|blz|beleza)\??)?[!.\s]*$/;
const pleasantry =
  /^(?:sim[, ]+)?(?:to |ta |estou |esta )?(?:tudo (?:bem|bom|certo|otimo|tranquilo)|bem|otimo|de boa)(?:[,!. ]+(?:e (?:voce|vc|contigo|ai)|gracas a deus|obrigad[oa]))*[?!. ]*$/;
const welcomeRows =
  /^Quero (?:agendar um horário|ver serviços e preços|falar com a equipe)$/;

/** "Boa noite! Tudo bem?": the greeting reply, sent without a menu. */
export function pureGreeting(reply: string) {
  return /^(?:Bom dia|Boa tarde|Boa noite|Olá)! Tudo bem\?$/.test(reply.trim());
}

/**
 * The shop WhatsApp is often someone's personal phone. The assistant greets
 * back, and after that only talks about the business:
 * - a greeting gets "Boa noite! Tudo bem?";
 * - a reply to that "Tudo bem?" ("tudo ótimo, e você?") gets one answer;
 * - a list tap or a message about the business (serviço, horário, preço…);
 * - an answer within 30 minutes to a business question the assistant asked.
 * Anything else stays in the inbox for the team.
 */
export async function assistantMayAnswer(input: {
  text: string;
  /** Loaded only when the cheap checks did not decide. */
  store: () => Promise<Store>;
  messages: ConversationMessage[];
  now?: Date;
}) {
  const text = input.text.trim();
  const value = plain(text);
  const now = (input.now || new Date()).getTime();
  if (greeting.test(value)) return true;
  if (/^SF_[A-Z_]+\|/.test(text) || welcomeRows.test(text)) return true;
  if (
    /\b(?:quanto (?:custa|e|fica|sai|ta|esta)|marcar|marca um|atende|atendem|tem vaga)\b/.test(
      value,
    )
  )
    return true;
  const last = input.messages.findLast(
    (m) => m.role === "assistant" || m.role === "staff",
  );
  const recent =
    last?.role === "assistant" &&
    now - Date.parse(last.createdAt) <= 30 * 60_000;
  if (recent && pureGreeting(last.body)) {
    if (pleasantry.test(value)) return true;
  } else if (recent) return true;
  const store = await input.store();
  return !!menuSelection(store, text) || hasBusinessSubject(text, store);
}
