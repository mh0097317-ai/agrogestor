import type { ConversationMessage, Store } from "@/types";

/** "Boa noite! Tudo bem?": the greeting reply, sent without a menu. */
export function pureGreeting(reply: string) {
  return /^(?:Bom dia|Boa tarde|Boa noite|Olá)! Tudo bem\?$/.test(reply.trim());
}

/**
 * A recepcionista responde a qualquer mensagem escrita: cumprimento, assunto
 * da casa ou conversa solta ("teste", "ok"). Quem tira ela da conversa é a
 * equipe, respondendo pelo celular (modo humano por 30 minutos) ou pausando
 * no painel. Só mensagem vazia fica sem resposta.
 */
export async function assistantMayAnswer(input: {
  text: string;
  store: () => Promise<Store>;
  messages: ConversationMessage[];
  now?: Date;
}) {
  return !!input.text.trim();
}
