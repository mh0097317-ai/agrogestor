import {
  availableSlots,
  localDate,
  nextFreeByProfessional,
} from "@/lib/availability";
import { requestedTimePeriod, matchesTimePeriod } from "@/lib/time-period";
import type { Store, ConversationMessage } from "@/types";
import type { Interpretation } from "./understanding";
import { resolveBookingDate } from "./booking-date";
import { asksForDayOptions } from "./day-options";

/** Prices/dates/slots never come from model prose. Only current business data. */
export function availabilityReply(
  selection: Interpretation,
  store: Store,
  text: string,
  recent: ConversationMessage[] = [],
  now = new Date(),
) {
  if (
    selection.confidence < 0.7 ||
    !selection.serviceIds.length ||
    !["AVAILABILITY", "BOOK", "CONTINUE"].includes(selection.intent) ||
    !(
      selection.nextAction === "CONSULT" ||
      (selection.nextAction === "ASK" &&
        (selection.missing.includes("time") ||
          (!selection.date && selection.missing.includes("date"))))
    )
  )
    return null;
  if (
    selection.professionalId &&
    selection.professionalId !== "any" &&
    !store.professionals.some(
      (p) =>
        p.id === selection.professionalId &&
        p.active &&
        p.businessId === store.business.id,
    )
  )
    return null;
  if (
    selection.serviceIds.some(
      (id) =>
        !store.services.some(
          (s) => s.businessId === store.business.id && s.id === id && s.active,
        ),
    )
  )
    return null;
  let period = requestedTimePeriod(text);
  const clock =
    /\b(\d{1,2})(?::(\d{2})|h(\d{2})?)\b|\b(?:as|pelas)\s+(\d{1,2})\b/i.exec(
      text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    );
  const requestedClock = clock
    ? `${(clock[1] || clock[4]).padStart(2, "0")}:${clock[2] || clock[3] || "00"}`
    : "";
  const matchesPreference = (slot: { time: string }) =>
    matchesTimePeriod(slot.time, period) &&
    (!requestedClock || slot.time === requestedClock);
  if (
    period === "all" &&
    !/qualquer|tanto faz|todos os hor[aá]rios/i.test(text)
  ) {
    for (const m of [...recent].reverse()) {
      if (
        m.role !== "customer" ||
        now.getTime() - Date.parse(m.createdAt) > 30 * 60_000
      )
        continue;
      const previous = requestedTimePeriod(m.body);
      if (previous !== "all") {
        period = previous;
        break;
      }
    }
  }
  const alternatives = asksForDayOptions(text);
  const dates = alternatives
    ? Array.from({ length: 7 }, (_, i) =>
        localDate(new Date(now.getTime() + i * 86400000)),
      ).filter((date) => date !== resolveBookingDate(selection.date, now))
    : [resolveBookingDate(selection.date, now)].filter(Boolean);
  // Propose a real nearest date when none was chosen. This is an offer, never
  // a customer selection or permission to book. Invalid supplied dates need clarification.
  if (!dates.length && !selection.date) {
    const scoped =
      selection.professionalId && selection.professionalId !== "any"
        ? {
            ...store,
            professionals: store.professionals.filter(
              (p) => p.id === selection.professionalId,
            ),
          }
        : store;
    const earliest = Object.values(
      nextFreeByProfessional(
        scoped,
        selection.serviceIds,
        now,
        14,
        matchesPreference,
      ),
    ).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
    if (!earliest)
      return "Não encontrei horários livres nesse período nos próximos dias. Você prefere outro período ou falar com a equipe?";
    dates.push(localDate(new Date(earliest.start)));
  }
  if (!dates.length) return "Qual dia você prefere para esse serviço?";
  const options = dates
    .flatMap((date) =>
      availableSlots(
        store,
        selection.serviceIds,
        selection.professionalId || "any",
        date,
        now,
      )
        .filter(matchesPreference)
        .slice(0, alternatives ? 1 : 3)
        .map(
          (slot) =>
            `${date.split("-").reverse().join("/")} às ${slot.time} com ${store.professionals.find((p) => p.id === slot.professionalId)?.name || "a equipe"}`,
        ),
    )
    .slice(0, 3);
  return options.length
    ? `Tenho ${options.join("; ")}. Qual você prefere?`
    : "Não encontrei horários livres nesse período. Você prefere outro dia ou período?";
}
