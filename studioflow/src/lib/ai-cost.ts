/*
 * Estimativa de custo da IA. Preços oficiais da Anthropic em US$ por milhão
 * de tokens (entrada / saída), conferidos em 26/11/2026. Não inclui cache nem
 * transcrição de áudio; é estimativa para gestão, não fatura.
 */
export const modelPrices: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** US$ de um uso; modelo sem preço conhecido volta null (não chuta). */
export function usageUsd(usage: ModelUsage): number | null {
  const price = modelPrices[usage.model];
  if (!price) return null;
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}

export interface CostSummary {
  usd: number;
  /** null quando o câmbio não está configurado. */
  brlCents: number | null;
  inputTokens: number;
  outputTokens: number;
  /** Tokens de modelos sem preço cadastrado (ficam fora do valor). */
  unpricedTokens: number;
}

export function costSummary(rows: ModelUsage[], usdBrl: number | null): CostSummary {
  let usd = 0;
  let unpricedTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const row of rows) {
    inputTokens += row.inputTokens;
    outputTokens += row.outputTokens;
    const value = usageUsd(row);
    if (value === null) unpricedTokens += row.inputTokens + row.outputTokens;
    else usd += value;
  }
  return {
    usd,
    brlCents: usdBrl ? Math.round(usd * usdBrl * 100) : null,
    inputTokens,
    outputTokens,
    unpricedTokens,
  };
}

export type BudgetState = "none" | "ok" | "near" | "over" | "unknown";

/** Teto mensal em centavos de real. Sem câmbio não dá para comparar. */
export function budgetState(spentBrlCents: number | null, budgetCents: number | null): BudgetState {
  if (budgetCents === null || budgetCents === undefined) return "none";
  if (spentBrlCents === null) return "unknown";
  if (spentBrlCents >= budgetCents) return "over";
  if (spentBrlCents >= budgetCents * 0.8) return "near";
  return "ok";
}

/** Primeiro dia do mês corrente no calendário de São Paulo (yyyy-mm-01). */
export function monthStart(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  return `${day.slice(0, 7)}-01`;
}
