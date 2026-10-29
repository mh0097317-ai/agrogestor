import type { ConversationMessage } from "@/types";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** The model may acknowledge context; prices, slots and the next question stay verified. */
export function conversationalReply(
  reply: string,
  acknowledgement: string | undefined,
  recent: ConversationMessage[],
) {
  const lead = acknowledgement?.trim();
  if (!lead || lead.length > 140 || /[\d?$<>@#*\n]|https?:|www\./i.test(lead))
    return reply;
  const plain = normalize(lead);
  // No model-supplied booking, availability, catalog, contact or payment facts.
  if (
    /\b(confirm|reserv|agendad|marcad|vaga|disponiv|horario|preco|valor|custa|reais|desconto|gratis|gratuit|ganh|estoque|vend|produto|oferec|inclui|incluid|pag|pix|endereco|telefone|profissional|barbeiro|temos|tenho|sou|me chamo)\w*/.test(
      plain,
    )
  )
    return reply;
  if (/^(oi\b|ola\b|bom dia\b|boa tarde\b|boa noite\b)/.test(plain))
    return reply;
  if (
    recent
      .filter((m) => m.role === "assistant")
      .slice(-3)
      .some((m) => normalize(m.body).includes(plain))
  )
    return reply;
  return `${lead}\n\n${reply}`;
}
