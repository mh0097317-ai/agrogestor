import type { ConversationMessage, Store } from "@/types";
import type { Interpretation } from "./understanding";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Recognize a choice only against a recent offer in this chat, never an invented date. */
export function offeredChoice(
  text: string,
  store: Store,
  recent: ConversationMessage[],
  at: string | Date = new Date(),
): Interpretation | null {
  const last = recent.at(-1);
  let value = normalize(text.trim());
  if (
    /^(sim|pode sim|pode ser|confirmado)[.!]?$/.test(value) &&
    last?.role === "assistant" &&
    /posso confirmar/i.test(last.body)
  ) {
    const dates = [...last.body.matchAll(/\b\d{2}\/\d{2}\/\d{4}\b/g)];
    const times = [...last.body.matchAll(/\b\d{2}:\d{2}\b/g)];
    if (dates.length !== 1 || times.length !== 1) return null;
    value = `quero dia ${dates[0][0]} as ${times[0][0]}`;
  }
  const match =
    /^(?:quero|prefiro|pode ser|vamos marcar|fica) (?:dia (\d{1,2})(?:\/(\d{1,2})(?:\/(\d{4}))?)? )?(?:as |o horario das |para as )?(\d{1,2})(?::(\d{2})|h(\d{2})?)(?: por favor| ta otimo)?[.!]?$/.exec(
      value,
    );
  if (!match) return null;
  const age = new Date(at).getTime() - Date.parse(last?.createdAt || "");
  if (
    !last ||
    last.role !== "assistant" ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 30 * 60_000 ||
    !/qual.*prefere|qual.*melhor|posso confirmar/i.test(last.body)
  )
    return null;
  const time = `${match[4].padStart(2, "0")}:${match[5] || match[6] || "00"}`;
  // Each dated segment may contain several times for the same professional.
  const segments = [
    ...last.body.matchAll(
      /(\d{2})\/(\d{2})\/(\d{4})([^;]*?)(?=\d{2}\/\d{2}\/\d{4}|;|$)/g,
    ),
  ];
  const dates = [
    ...new Set(
      segments
        .filter(
          (s) =>
            (!match[1] || Number(s[1]) === Number(match[1])) &&
            (!match[2] || Number(s[2]) === Number(match[2])) &&
            (!match[3] || s[3] === match[3]) &&
            [...s[4].matchAll(/\b(\d{2}:\d{2})\b/g)].some(
              (clock) => clock[1] === time,
            ),
        )
        .map((s) => `${s[3]}-${s[2]}-${s[1]}`),
    ),
  ];
  if (dates.length !== 1) return null;
  const context = normalize(recent.map((m) => m.body).join("\n"));
  const services = store.services.filter(
    (s) =>
      s.businessId === store.business.id &&
      s.active &&
      context.includes(normalize(s.name)),
  );
  const professionals = store.professionals.filter(
    (p) =>
      p.businessId === store.business.id &&
      p.active &&
      (store.professionals.filter((p) => p.active).length === 1 ||
        normalize(last.body).includes(normalize(p.name))),
  );
  if (
    services.length !== 1 ||
    professionals.length !== 1 ||
    !services[0].professionalIds.includes(professionals[0].id)
  )
    return null;
  return {
    intent: "BOOK",
    stage: "CONFIRMING",
    confidence: 1,
    serviceIds: [services[0].id],
    professionalId: professionals[0].id,
    date: dates[0],
    time,
    missing: [],
    nextAction: "CONFIRM",
  };
}
