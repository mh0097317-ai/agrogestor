import type { ConversationMessage } from "@/types";

export interface AnalysisRun {
  state: string;
  attempts: number;
  error_code?: string | null;
  updated_at?: string;
}

/** Also used by the API; the database rechecks these guards atomically. */
export function analysisBlockReason({
  channel,
  messages,
  run,
  processingUntil,
  now = Date.now(),
}: {
  channel: string;
  messages: ConversationMessage[];
  run?: AnalysisRun | null;
  processingUntil?: string | null;
  now?: number;
}): string | null {
  if (channel !== "whatsapp") return "Disponível nas conversas de WhatsApp.";
  if (run?.state === "SENDING" || run?.error_code === "delivery-unconfirmed")
    return "Confira a entrega no WhatsApp antes de tentar novamente.";
  if (
    (processingUntil && Date.parse(processingUntil) > now) ||
    (run?.state === "RETRY" &&
      run.attempts === 0 &&
      run.updated_at &&
      Date.parse(run.updated_at) > now - 15_000)
  )
    return "A análise já está em andamento. Aguarde o resultado.";
  const latest = messages.filter((m) => m.role !== "event").at(-1);
  if (!latest || latest.role !== "customer")
    return "Não há mensagem do cliente aguardando resposta.";
  if (Date.parse(latest.createdAt) < now - 24 * 60 * 60 * 1000)
    return "A última mensagem tem mais de 24 horas. Aguarde um novo contato.";
  return null;
}
