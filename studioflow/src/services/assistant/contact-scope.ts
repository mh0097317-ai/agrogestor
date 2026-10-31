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
/**
 * How customers really ask, slang and shorthand included: price, booking,
 * opening hours, payment. Time words alone ("amanhã te ligo") never count.
 */
const businessAsk = new RegExp(
  [
    "\\b(?:quanto|qnto|qto|quato)\\b",
    "\\bqual (?:o |e o |eh o )?(?:valor|preco|precinho)",
    "\\b(?:valor|valores|preco|precos|vlr|orcamento|tabela|promocao|promo|pacote|combo)\\b",
    "\\b(?:cobra|cobram|cobrar|custa|custam|sai por|fica por)\\b",
    "\\b(?:marcar|marca|marcacao|agendar|agenda|agendamento|reservar|remarcar|desmarcar|cancelar)\\b",
    "\\b(?:atende|atendem|atendendo|atendimento|encaixa|encaixe|encaixar)\\b",
    "\\btem (?:vaga|horario|horarios|hr|hrs|hora|como|lugar|espaco)\\b",
    "\\b(?:da|dá) (?:pra|para) (?:ir|passar|marcar|encaixar|cortar|fazer|chegar)\\b",
    "\\b(?:posso|consigo|pode) (?:ir|passar|chegar|marcar|cortar)\\b",
    "\\b(?:ta|esta|tao|estao|fica|vai ta|vai estar) (?:aberto|aberta|abertos|funcionando)\\b",
    "\\b(?:abre|abrem|fecha|fecham|funciona|funcionam|expediente)\\b",
    "\\b(?:aceita|aceitam) (?:pix|cartao|credito|debito|dinheiro)\\b",
    "\\b(?:onde fica|endereco|localizacao|como chego)\\b",
    "\\b(?:fila|demora|esperar|espera muito)\\b",
  ].join("|"),
);
/** The trade's own words: a message with them is about the shop. */
const barberWords =
  /\b(?:corte|cortar|cortes|cabelo|barba|barbinha|bigode|cavanhaque|degrade|fade|disfarcado|navalhado|navalha|pezinho|pe do cabelo|risco|risquinho|desenho|freestyle|platinado|nevou|luzes|reflexo|mechas|progressiva|selagem|botox capilar|relaxamento|alisamento|hidratacao|pigmentacao|tintura|coloracao|sobrancelha|depilacao|limpeza de pele|barboterapia|toalha quente|corte infantil|social|tesoura|maquina|militar|moicano|mullet|taper|low fade|mid fade|barbeiro|barbearia|cabeleireiro|salao)\b/;
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
  if (businessAsk.test(value) || barberWords.test(value)) return true;
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
