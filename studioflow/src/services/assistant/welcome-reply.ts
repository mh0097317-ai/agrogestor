import type { ConversationMessage } from "@/types";

/** Deterministic warmth also applies to fast catalog replies, without a model call. */
export function welcomeReply(
  reply: string,
  recent: ConversationMessage[],
  customerText = "",
  now = new Date(),
) {
  if (!reply.trim()) return reply;
  // \b is ASCII-only: "Olá!" has no boundary after the "á".
  const greeting = /^(?:oi|ol[aá]|bom dia|boa tarde|boa noite)(?!\p{L})/iu;
  if (greeting.test(reply.trim())) return reply;
  const greeted =
    /(?:^|\n)(?:Cliente:\s*)?(?:oi\b|ol[aá]\b|bom dia\b|boa tarde\b|boa noite\b)/i.test(
      customerText.trim(),
    );
  const alreadyTalking = recent.some((message) => {
    const age = now.getTime() - Date.parse(message.createdAt);
    return (
      ["assistant", "staff"].includes(message.role) &&
      age >= 0 &&
      age <= 30 * 60_000
    );
  });
  if (alreadyTalking && !greeted) return reply;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  const hello =
    hour >= 5 && hour < 12
      ? "Bom dia"
      : hour < 18 && hour >= 12
        ? "Boa tarde"
        : "Boa noite";
  // "Tudo bem?" is a question: answering it with "Ótimo!" reads as if the
  // customer had already replied.
  const rest = reply.replace(
    /^(?:ótimo|otimo|perfeito|beleza|show|certo|maravilha)[!.,]\s*/i,
    "",
  );
  return `${hello}! Tudo bem?\n\n${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
}
