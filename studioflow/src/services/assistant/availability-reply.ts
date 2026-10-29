import {
  availableSlots,
  availableSlotsByProfessional,
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
    (!requestedClock ||
      (/ap[oó]s/i.test(text)
        ? slot.time > requestedClock
        : slot.time === requestedClock));
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
  const candidates = dates.flatMap((date) =>
    (selection.professionalId && selection.professionalId !== "any"
      ? availableSlots(
          store,
          selection.serviceIds,
          selection.professionalId,
          date,
          now,
        )
      : availableSlotsByProfessional(store, selection.serviceIds, date, now)
    )
      .filter(matchesPreference)
      .filter((_slot, index) => !alternatives || index === 0)
      .map((slot) => ({ date, ...slot })),
  );
  if (!candidates.length)
    return "Não encontrei horários livres nesse período. Você prefere outro dia ou período?";
  const orderedCandidates = [...candidates].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.time.localeCompare(b.time) ||
      (
        store.professionals.find((p) => p.id === a.professionalId)?.name || ""
      ).localeCompare(
        store.professionals.find((p) => p.id === b.professionalId)?.name || "",
        "pt-BR",
      ),
  );
  if (alternatives) orderedCandidates.splice(3);
  const groups = new Map<string, typeof orderedCandidates>();
  // The text shows 3 times per person; say how many more the list holds, so
  // "09:00, 09:30 ou 10:00" does not read as the whole day.
  const totals = new Map<string, number>();
  for (const slot of orderedCandidates) {
    const key = `${slot.date}:${slot.professionalId}`;
    totals.set(key, (totals.get(key) || 0) + 1);
  }
  for (const slot of orderedCandidates) {
    const key = `${slot.date}:${slot.professionalId}`;
    if (
      (!groups.has(key) && groups.size >= 3) ||
      (groups.get(key)?.length || 0) >= 3
    )
      continue;
    groups.set(key, [...(groups.get(key) || []), slot]);
  }
  const offers = [...groups.values()].map((slots) => {
    const { date, professionalId } = slots[0];
    const weekday = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(`${date}T12:00:00Z`));
    const rawName =
      store.professionals.find((p) => p.id === professionalId)?.name ||
      "a equipe";
    const name =
      rawName === rawName.toUpperCase()
        ? rawName
            .toLowerCase()
            .replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase())
        : rawName;
    const times = slots.map((s) => s.time);
    const extra = (totals.get(`${date}:${professionalId}`) || 0) - times.length;
    const clocks =
      extra > 0
        ? `${times.join(", ")} e mais ${extra} horário${extra > 1 ? "s" : ""}`
        : times.length > 1
          ? `${times.slice(0, -1).join(", ")} ou ${times.at(-1)}`
          : times[0];
    const label = date.split("-").reverse().join("/");
    return `${name} — ${weekday}, ${label}, às ${clocks}`;
  });
  const people = new Set(
    [...groups.values()].map((slots) => slots[0].professionalId),
  );
  const more = [...groups.entries()].some(
    ([key, slots]) => (totals.get(key) || 0) > slots.length,
  );
  return `Tenho estas opções disponíveis:\n\n${offers.join("\n\n")}\n\n${more ? "Os outros horários estão na lista abaixo.\n\n" : ""}${people.size > 1 ? "Com quem você prefere marcar?" : "Qual desses horários fica melhor para você?"}`;
}
