import { matchesTimePeriod, type TimePeriod } from "@/lib/time-period";

export function unverifiedAvailabilityClaim(reply: string, verified: boolean) {
  return (
    !verified &&
    /\b(?:tenho|temos|h[aá]|consigo|tem)\s+(?:hor[aá]rios?(?:\s+livres?)?|disponibilidade|vagas?)\b/i.test(
      reply,
    )
  );
}

export function unverifiedBookingClaim(reply: string) {
  const text = reply
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const positive = text.replace(
    /\b(?:ainda\s+)?nao\s+(?:esta\s+|foi\s+|ficou\s+)?(?:agendei|marquei|reservei|confirmad[oa]|marcado|agendado|reservado|garantido)\b/g,
    "",
  );
  return /\b(?:agendei|marquei|reservei|confirmad[oa]|agendament[oa] realizado)\b|\b(?:pronto|prontinho|tudo certo)[,!]?\s+(?:marcado|agendado|reservado)\b|\b(?:horario|agendamento|reserva)\s+(?:esta\s+|ja\s+|foi\s+|ficou\s+)?(?:marcado|agendado|reservado|garantido)\b/.test(
    positive,
  );
}
export function offersOutsidePeriod(reply: string, period: TimePeriod) {
  if (period === "all") return false;
  const times = [
    ...reply.matchAll(/\b([01]?\d|2[0-3])(?::([0-5]\d)|h(?:([0-5]\d))?)\b/g),
  ];
  return times.some(
    (match) =>
      !matchesTimePeriod(`${match[1]}:${match[2] || match[3] || "00"}`, period),
  );
}
