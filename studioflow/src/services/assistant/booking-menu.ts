import {
  availableSlots,
  availableSlotsByProfessional,
  localDate,
  nextFreeByProfessional,
} from "@/lib/availability";
import { requestedTimePeriod, matchesTimePeriod } from "@/lib/time-period";
import { money } from "@/lib/utils";
import type { Store } from "@/types";
import type { Interpretation } from "./understanding";
import { resolveBookingDate } from "./booking-date";

export interface BookingMenu {
  title: string;
  button: string;
  rows: { id: string; title: string; description: string }[];
  /** Keep a short welcome menu in WhatsApp's native list sheet, not quick replies. */
  forceList?: boolean;
}
const readable = (value: string) => value.replace(/[\r\n<>]/g, " ").trim();
const name = (value: string) =>
  value === value.toUpperCase()
    ? value.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())
    : value;
const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${date}T12:00:00Z`));
/** wrap() appends the asked period to every row id, slot ids included. */
const periodSuffix = / (?:de manhã|à tarde|à noite)$/;
const dateText = (date: string) => date.split("-").reverse().join("/");
const confirmationDayLabel = (date: string) =>
  `${new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00Z`))}, ${dateText(date)}`;
function menu(
  title: string,
  button: string,
  rows: BookingMenu["rows"],
): BookingMenu | null {
  if (!rows.length || rows.some((r) => r.id.length > 200)) return null;
  return {
    title: title.slice(0, 60),
    button: button.slice(0, 20),
    rows: rows.slice(0, 10).map((r) => ({
      ...r,
      title: r.title.slice(0, 24),
      description: r.description.slice(0, 72),
    })),
  };
}

/** All options come from this business's live public catalog/availability. */
export function bookingMenu(
  store: Store,
  selection: Interpretation | undefined,
  text: string,
  now = new Date(),
  reply = "",
): BookingMenu | null {
  // Asking the name: the answer is typed, a list would only restart the choice.
  if (/como você prefere ser chamado|qual nome você prefere/i.test(reply))
    return null;
  // A summary to approve gets two buttons, never another list of times.
  if (/posso confirmar/i.test(reply)) {
    const day = /\b(\d{2})\/(\d{2})\/(\d{4})\b/.exec(reply);
    const chosen = (selection?.serviceIds || [])
      .map((id) => store.services.find((s) => s.id === id && s.active))
      .filter((s) => !!s);
    if (!day || !chosen.length) return null;
    return menu("Confirmar horário", "Responder", [
      {
        id: "Sim",
        title: "Confirmar",
        description: "Reservar este horário",
      },
      {
        id: `Consultar horários para ${chosen.map((s) => readable(s.name)).join(" + ")} no dia ${day[0]}`,
        title: "Outro horário",
        description: "Ver os outros horários do dia",
      },
    ]);
  }
  const period = requestedTimePeriod(text);
  const suffix =
    period === "morning"
      ? " de manhã"
      : period === "afternoon"
        ? " à tarde"
        : period === "evening"
          ? " à noite"
          : "";
  const wrap = (title: string, button: string, rows: BookingMenu["rows"]) =>
    menu(
      title,
      button,
      rows.map((r) => ({ ...r, id: r.id + suffix })),
    );
  const greeting =
    /^(?:oi|ol[aá]|bom dia|boa tarde|boa noite|opa|e a[ií]|eae)(?:[,!?.\s].*)?$/i.test(
      text.trim(),
    );
  const pagination =
    /p[aá]gina \d+ dos (?:servi[cç]os|dias|hor[aá]rios|profissionais)/i.test(
      text,
    );
  if (
    !greeting &&
    !pagination &&
    (!selection ||
      !["PRICE", "BOOK", "AVAILABILITY", "CONTINUE"].includes(selection.intent))
  )
    return null;
  if (text.includes("Consultar a opção:")) return null;
  if (greeting && (!selection || selection.intent === "GENERAL")) {
    const welcome = menu("Como posso ajudar?", "Ver opções", [
      {
        id: "Quero agendar um horário",
        title: "Agendar horário",
        description: "Escolher serviço, barbeiro e horário",
      },
      {
        id: "Quero ver serviços e preços",
        title: "Serviços e preços",
        description: "Consultar o catálogo da barbearia",
      },
      {
        id: "Quero falar com a equipe",
        title: "Falar com a equipe",
        description: "Pedir ajuda de uma pessoa",
      },
    ]);
    return welcome ? { ...welcome, forceList: true } : null;
  }
  const services = store.services.filter(
    (s) => s.businessId === store.business.id && s.active,
  );
  const ids = /p[aá]gina \d+ dos servi[cç]os/i.test(text)
    ? []
    : selection?.serviceIds || [];
  if (!ids.length) {
    const page = Number(
      /p[aá]gina (\d+) dos servi[cç]os/i.exec(text)?.[1] || 1,
    );
    if (page < 1 || page > 30) return null;
    const rows = services.slice((page - 1) * 9, page * 9).map((s) => ({
      id: `Consultar horários para ${readable(s.name)}`,
      title: name(s.name),
      description: `${money(s.price)} · ${s.duration} min`,
    }));
    if (services.length > page * 9)
      rows.push({
        id: `Ver página ${page + 1} dos serviços`,
        title: "Mais serviços",
        description: "Ver outras opções",
      });
    return wrap("O que você quer agendar?", "Ver serviços", rows);
  }
  if (ids.length > 3 || ids.some((id) => !services.some((s) => s.id === id)))
    return null;
  const serviceNames = ids
    .map((id) => readable(services.find((s) => s.id === id)!.name))
    .join(" + ");
  let date = resolveBookingDate(selection?.date || "", now);
  // No day asked: the list opens on the nearest free day, the same one the
  // message describes, with "Outros dias" for the rest. Never selects or books.
  const proposed =
    !date && !selection?.date && !/p[aá]gina \d+ dos dias/i.test(text);
  if (proposed) {
    const nearest = Object.values(
      nextFreeByProfessional(store, ids, now, 14, (slot) =>
        matchesTimePeriod(slot.time, period),
      ),
    )
      .filter(
        (slot) =>
          !selection?.professionalId ||
          selection.professionalId === "any" ||
          slot.professionalId === selection.professionalId,
      )
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
    if (nearest) date = localDate(new Date(nearest.start));
  }
  const otherDays = {
    id: `Consultar ${serviceNames}: página 1 dos dias`,
    title: "Outros dias",
    description: "Escolher outro dia",
  };
  const room = proposed && date ? 8 : 9;
  if (!date) {
    const page = Number(/p[aá]gina (\d+) dos dias/i.exec(text)?.[1] || 1);
    if (page < 1 || page > 8) return null;
    const rows: BookingMenu["rows"] = [];
    for (let offset = (page - 1) * 7; offset < page * 7; offset++) {
      const day = localDate(new Date(now.getTime() + offset * 86400000));
      const slots = availableSlots(
        store,
        ids,
        selection?.professionalId || "any",
        day,
        now,
      ).filter((s) => matchesTimePeriod(s.time, period));
      if (slots.length)
        rows.push({
          id: `Consultar horários para ${serviceNames} no dia ${dateText(day)}`,
          title: dayLabel(day),
          description: `${slots.length} opções disponíveis`,
        });
    }
    if (page * 7 < Math.min(56, store.settings.maxDays))
      rows.push({
        id: `Consultar ${serviceNames}: página ${page + 1} dos dias`,
        title: "Outros dias",
        description: "Consultar a próxima semana",
      });
    return wrap("Escolha um dia", "Ver dias", rows);
  }
  const pro = selection?.professionalId;
  if (!pro || pro === "any") {
    const page = Number(
      /p[aá]gina (\d+) dos hor[aá]rios/i.exec(text)?.[1] || 1,
    );
    if (page < 1 || page > 30) return null;
    const matchingSlots = availableSlotsByProfessional(
      store,
      ids,
      date,
      now,
    ).filter((s) => matchesTimePeriod(s.time, period));
    const orderedSlots = [...matchingSlots].sort(
      (a, b) =>
        a.time.localeCompare(b.time) ||
        store.professionals.findIndex(
          (person) => person.id === a.professionalId,
        ) -
          store.professionals.findIndex(
            (person) => person.id === b.professionalId,
          ),
    );
    const rows = orderedSlots
      .slice((page - 1) * room, page * room)
      .flatMap((slot) => {
        const person = store.professionals.find(
          (candidate) =>
            candidate.id === slot.professionalId &&
            candidate.businessId === store.business.id &&
            candidate.active,
        );
        if (!person) return [];
        const professionalName = name(person.name);
        return [
          {
            id: `SF_SLOT|${date}|${slot.time}|${person.id}|${ids.join(",")}`,
            title: `${professionalName.slice(0, 16)} · ${slot.time}`,
            description: `Disponível · ${dayLabel(date)} · ${serviceNames}`,
          },
        ];
      });
    if (orderedSlots.length > page * room)
      rows.push({
        id: `Consultar ${serviceNames} no dia ${dateText(date)}: página ${page + 1} dos horários`,
        title: "Mais horários",
        description: "Ver outras opções disponíveis",
      });
    if (proposed) rows.push(otherDays);
    return wrap(`Horários · ${dayLabel(date)}`, "Escolher horário", rows);
  }
  const person = store.professionals.find(
    (p) => p.id === pro && p.businessId === store.business.id && p.active,
  );
  if (!person) return null;
  const after = /ap[oó]s (\d{2}:\d{2})/i.exec(text)?.[1];
  const slots = availableSlots(store, ids, pro, date, now).filter(
    (s) => matchesTimePeriod(s.time, period) && (!after || s.time > after),
  );
  const rows = slots.slice(0, room).map((s) => ({
    id: `Consultar a opção: ${serviceNames} no dia ${dateText(date)} às ${s.time} com ${readable(person.name)}`,
    title: s.time,
    description: `${name(person.name)} · ${dayLabel(date)}`,
  }));
  if (slots.length > room)
    rows.push({
      id: `Consultar horários para ${serviceNames} no dia ${dateText(date)} com ${readable(person.name)} após ${slots[room - 1].time}`,
      title: "Mais horários",
      description: "Ver opções mais tarde",
    });
  if (proposed) rows.push(otherDays);
  return wrap(`Horários · ${name(person.name)}`, "Ver horários", rows);
}

/**
 * Rows of the menus above come back as their ids. Read them here, without a
 * model call: a model sees "SF_SLOT|…" as noise and answers as small talk.
 */
export function menuSelection(
  store: Store,
  text: string,
): Interpretation | null {
  const value = text.trim().replace(periodSuffix, "");
  const services = store.services.filter(
    (s) => s.businessId === store.business.id && s.active,
  );
  const people = store.professionals.filter(
    (p) => p.businessId === store.business.id && p.active,
  );
  const base: Interpretation = {
    intent: "AVAILABILITY",
    stage: "CHOOSING_TIME",
    confidence: 1,
    serviceIds: [],
    professionalId: "",
    date: "",
    time: "",
    missing: [],
    nextAction: "CONSULT",
  };
  const slot =
    /^SF_SLOT\|(\d{4}-\d{2}-\d{2})\|(\d{2}:\d{2})\|([^|]+)\|([^|]+)$/.exec(
      value,
    );
  if (slot) {
    const serviceIds = slot[4].split(",");
    if (
      !people.some((p) => p.id === slot[3]) ||
      serviceIds.some((id) => !services.some((s) => s.id === id))
    )
      return null;
    return {
      ...base,
      intent: "BOOK",
      stage: "CONFIRMING",
      serviceIds,
      professionalId: slot[3],
      date: slot[1],
      time: slot[2],
      missing: ["confirmation"],
      nextAction: "CONFIRM",
    };
  }
  if (/^Ver p[aá]gina \d+ dos servi[cç]os/i.test(value))
    return { ...base, intent: "BOOK", missing: ["service"], nextAction: "ASK" };
  const row =
    /^Consultar (horários para |a opção: )?(.+?)(?: no dia (\d{2})\/(\d{2})\/(\d{4}))?(?: às (\d{2}:\d{2}))?(?: com (.+?))?(?: após \d{2}:\d{2})?(?:: página \d+ dos (?:dias|horários))?$/.exec(
      value,
    );
  if (!row) return null;
  const same = (a: string, b: string) =>
    readable(a).toLowerCase() === b.trim().toLowerCase();
  const serviceIds = row[2]
    .split(" + ")
    .map((part) => services.find((s) => same(s.name, part))?.id || "");
  if (serviceIds.some((id) => !id)) return null;
  const person = row[7] ? people.find((p) => same(p.name, row[7])) : undefined;
  if (row[7] && !person) return null;
  const option = row[1] === "a opção: ";
  if (option && (!row[3] || !row[6] || !person)) return null;
  return {
    ...base,
    ...(option
      ? {
          intent: "BOOK" as const,
          stage: "CONFIRMING" as const,
          missing: ["confirmation" as const],
          nextAction: "CONFIRM" as const,
        }
      : {}),
    serviceIds,
    professionalId: person?.id || "",
    date: row[3] ? `${row[5]}-${row[4]}-${row[3]}` : "",
    time: row[6] || "",
  };
}

/** "Mais horários" sends the next list; the text must not repeat the first page. */
export function menuPageReply(text: string) {
  return /: p[aá]gina \d+ dos (?:dias|hor[aá]rios)/i.test(text)
    ? "Separei mais opções na lista abaixo. É só tocar na que preferir."
    : null;
}

/** WhatsApp bolds with one asterisk and has no headings. */
export function whatsappText(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "_$1_")
    .replace(/^#{1,6}\s+/gm, "");
}

/** Selecting a list row requests review; booking still requires the normal confirmation. */
export function menuChoiceReply(
  store: Store,
  selection: Interpretation,
  text: string,
  customerName?: string,
  now = new Date(),
) {
  const encoded =
    /^SF_SLOT\|(\d{4}-\d{2}-\d{2})\|(\d{2}:\d{2})\|([^|]+)\|([^|]+)$/.exec(
      text.trim().replace(periodSuffix, ""),
    );
  if (!encoded && !text.includes("Consultar a opção:")) return null;
  const date = encoded ? encoded[1] : resolveBookingDate(selection.date, now);
  const time = encoded ? encoded[2] : /às (\d{2}:\d{2})/.exec(text)?.[1];
  const professionalId = encoded ? encoded[3] : selection.professionalId;
  const serviceIds = encoded ? encoded[4].split(",") : selection.serviceIds;
  if (
    !date ||
    !time ||
    !serviceIds.length ||
    !professionalId ||
    professionalId === "any" ||
    serviceIds.some(
      (id) =>
        !store.services.some(
          (s) => s.id === id && s.businessId === store.business.id && s.active,
        ),
    ) ||
    !store.professionals.some(
      (p) =>
        p.id === professionalId &&
        p.businessId === store.business.id &&
        p.active,
    )
  )
    return "Vamos conferir essa opção. Qual dia e horário você prefere?";
  const slot = availableSlots(
    store,
    serviceIds,
    professionalId,
    date,
    now,
  ).find((s) => s.time === time);
  if (!slot)
    return "Esse horário não está mais disponível. Quer que eu procure outra opção?";
  const person = store.professionals.find((p) => p.id === slot.professionalId);
  // Include the year in the confirmation summary. The next affirmative reply
  // is resolved from this message, so a day/month-only label loses the slot
  // context and makes the assistant ask for date and time again.
  return `Essa opção está livre: ${confirmationDayLabel(date)}, às ${time}${person ? ` com ${name(person.name)}` : ""}.\n\n${customerName ? "Posso confirmar esse horário em seu nome?" : "Como você prefere ser chamado para reservar esse horário?"}`;
}
