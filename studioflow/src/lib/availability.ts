import type { Professional, Slot, Store } from "@/types";

export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const activeStatuses = new Set([
  "pending",
  "confirmed",
  "in_progress",
  "completed",
]);
export function localDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function brazilTime(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`);
}
export function overlaps(
  start: number,
  end: number,
  otherStart: number,
  otherEnd: number,
) {
  return start < otherEnd && end > otherStart;
}
export function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if ((digits.length === 13 || digits.length === 12) && digits.startsWith("55"))
    digits = digits.slice(2);
  const validDDD = new Set([
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "21",
    "22",
    "24",
    "27",
    "28",
    "31",
    "32",
    "33",
    "34",
    "35",
    "37",
    "38",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "47",
    "48",
    "49",
    "51",
    "53",
    "54",
    "55",
    "61",
    "62",
    "63",
    "64",
    "65",
    "66",
    "67",
    "68",
    "69",
    "71",
    "73",
    "74",
    "75",
    "77",
    "79",
    "81",
    "82",
    "83",
    "84",
    "85",
    "86",
    "87",
    "88",
    "89",
    "91",
    "92",
    "93",
    "94",
    "95",
    "96",
    "97",
    "98",
    "99",
  ]);
  if (
    !(
      (digits.length === 11 && digits[2] === "9") ||
      (digits.length === 10 && /^[2-5]$/.test(digits[2]))
    ) ||
    !validDDD.has(digits.slice(0, 2)) ||
    /^(\d)\1+$/.test(digits)
  )
    throw new DomainError("Informe um WhatsApp brasileiro válido com DDD.");
  return digits;
}

export function servicesFor(store: Store, ids: string[]) {
  if (!ids.length || new Set(ids).size !== ids.length)
    throw new DomainError("Selecione ao menos um serviço válido.");
  const result = ids.map((id) =>
    store.services.find(
      (service) =>
        service.id === id &&
        service.businessId === store.business.id &&
        service.active,
    ),
  );
  if (result.some((service) => !service))
    throw new DomainError("Um dos serviços não está disponível.");
  return result.map((service) => service!);
}
export function canAttend(
  store: Store,
  professional: Professional,
  serviceIds: string[],
) {
  return (
    professional.active &&
    professional.businessId === store.business.id &&
    servicesFor(store, serviceIds).every((service) =>
      service.professionalIds.includes(professional.id),
    )
  );
}

export function isAvailable(
  store: Store,
  professional: Professional,
  serviceIds: string[],
  startValue: string,
  now = new Date(),
  excludeId?: string,
  staff = false,
) {
  const start = new Date(startValue);
  if (
    !Number.isFinite(start.getTime()) ||
    !canAttend(store, professional, serviceIds)
  )
    return false;
  const date = localDate(start);
  const day = brazilTime(date, "12:00").getUTCDay();
  const settings = store.settings;
  if (
    !staff &&
    (start.getTime() < now.getTime() + settings.minNotice * 60_000 ||
      date > localDate(new Date(now.getTime() + settings.maxDays * 86_400_000)))
  )
    return false;
  if (!settings.openDays.includes(day) || !professional.days.includes(day))
    return false;
  const duration = servicesFor(store, serviceIds).reduce(
    (sum, service) => sum + service.duration,
    0,
  );
  const end = start.getTime() + (duration + settings.buffer) * 60_000;
  const earliest = Math.max(
    brazilTime(date, settings.openStart).getTime(),
    brazilTime(date, professional.start).getTime(),
  );
  const latest = Math.min(
    brazilTime(date, settings.openEnd).getTime(),
    brazilTime(date, professional.end).getTime(),
  );
  if (
    start.getTime() < earliest ||
    end > latest ||
    start.getSeconds() ||
    start.getMilliseconds()
  )
    return false;
  if (
    professional.breakStart &&
    professional.breakEnd &&
    overlaps(
      start.getTime(),
      end,
      brazilTime(date, professional.breakStart).getTime(),
      brazilTime(date, professional.breakEnd).getTime(),
    )
  )
    return false;
  if (
    store.blockedTimes.some(
      (block) =>
        block.businessId === store.business.id &&
        block.professionalId === professional.id &&
        overlaps(
          start.getTime(),
          end,
          new Date(block.start).getTime(),
          new Date(block.end).getTime(),
        ),
    )
  )
    return false;
  return !store.appointments.some(
    (appointment) =>
      appointment.id !== excludeId &&
      appointment.businessId === store.business.id &&
      appointment.professionalId === professional.id &&
      activeStatuses.has(appointment.status) &&
      overlaps(
        start.getTime(),
        end,
        new Date(appointment.start).getTime(),
        new Date(appointment.end).getTime() + settings.buffer * 60_000,
      ),
  );
}

export function availableSlots(
  store: Store,
  serviceIds: string[],
  professionalId: string,
  date: string,
  now = new Date(),
): Slot[] {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    localDate(brazilTime(date, "12:00")) !== date
  )
    throw new DomainError("Data inválida.");
  servicesFor(store, serviceIds);
  const professionals = store.professionals.filter(
    (professional) =>
      professionalId === "any" || professional.id === professionalId,
  );
  const slots: Slot[] = [];
  const duration = servicesFor(store, serviceIds).reduce(
    (sum, service) => sum + service.duration,
    0,
  );
  for (let minute = 0; minute < 24 * 60; minute += 30) {
    const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const start = brazilTime(date, time).toISOString();
    const professional = professionals.find((person) =>
      isAvailable(store, person, serviceIds, start, now),
    );
    if (professional)
      slots.push({
        time,
        professionalId: professional.id,
        start,
        end: new Date(
          new Date(start).getTime() + duration * 60_000,
        ).toISOString(),
      });
  }
  return slots;
}

export function chooseProfessional(
  store: Store,
  serviceIds: string[],
  professionalId: string,
  start: string,
  excludeId?: string,
  staff = false,
) {
  const professional = store.professionals.find(
    (person) =>
      (professionalId === "any" || person.id === professionalId) &&
      isAvailable(
        store,
        person,
        serviceIds,
        start,
        new Date(),
        excludeId,
        staff,
      ),
  );
  if (!professional)
    throw new DomainError(
      "Este horário acabou de ficar indisponível. Escolha outro horário.",
      409,
    );
  return professional;
}
