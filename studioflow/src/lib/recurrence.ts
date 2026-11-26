/*
 * Agendamentos recorrentes e "agendar o próximo". Brasília não tem horário de
 * verão desde 2019, então somar dias em milissegundos mantém o horário local.
 */
const DAY = 86_400_000;

/** Inícios das repetições depois do primeiro (o primeiro não entra). */
export function recurrenceStarts(firstIso: string, everyWeeks: number, count: number) {
  const weeks = Math.max(1, Math.min(8, Math.round(everyWeeks)));
  const total = Math.max(1, Math.min(12, Math.round(count)));
  const first = Date.parse(firstIso);
  return Array.from({ length: total - 1 }, (_, i) =>
    new Date(first + (i + 1) * weeks * 7 * DAY).toISOString(),
  );
}

/**
 * Sugestão de quando o cliente volta: a mediana dos intervalos entre as
 * visitas concluídas (de 7 a 90 dias); sem histórico, 21 dias.
 */
export function suggestedReturnDays(visitStarts: string[]) {
  const times = [...new Set(visitStarts)].map(Date.parse).filter(Number.isFinite).sort((a, b) => a - b);
  const gaps = times.slice(1).map((t, i) => Math.round((t - times[i]) / DAY)).filter((g) => g >= 7 && g <= 90);
  if (!gaps.length) return 21;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2);
}

/** Data (yyyy-mm-dd, São Paulo) daqui a N dias a partir de um início. */
export function dayAfter(startIso: string, days: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(Date.parse(startIso) + days * DAY),
  );
}
