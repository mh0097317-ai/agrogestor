export interface OperationSnapshot {
  businessId: string;
  checkedAt: string;
  runs: { state: string; errorCode: string | null; at: string }[];
  notifications: { status: string; kind: string; at: string }[];
  usage: {
    day: string;
    turns: number;
    inputTokens: number;
    outputTokens: number;
  }[];
  n8nConfigured: boolean;
  configurationError: boolean;
  demo: boolean;
}

export function usageSummary(
  rows: OperationSnapshot["usage"],
  day: string,
  limit: number,
) {
  const today = rows.find((row) => row.day === day);
  const turns = today?.turns || 0;
  const fraction = limit > 0 ? turns / limit : 0;
  return {
    turns,
    remaining: Math.max(0, limit - turns),
    fraction,
    alert: fraction >= 1 ? "blocked" : fraction >= 0.8 ? "near" : "normal",
    todayTokens: (today?.inputTokens || 0) + (today?.outputTokens || 0),
    periodTokens: rows.reduce(
      (sum, row) => sum + row.inputTokens + row.outputTokens,
      0,
    ),
  };
}

export const operationError: Record<string, string> = {
  "missing-key": "Credencial de IA pendente",
  "daily-limit": "Limite diário atingido",
  "provider-balance": "Saldo insuficiente no provedor",
  "provider-auth": "Credencial recusada pelo provedor",
  "provider-limit": "Limite do provedor",
  "provider-timeout": "Provedor demorou a responder",
  "delivery-unconfirmed":
    "Envio sem confirmação: confira o WhatsApp antes de repetir",
  "appointment-created":
    "Reserva já gravada: conferir a confirmação com o cliente",
};
