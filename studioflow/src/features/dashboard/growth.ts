import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Appointment, Store, WaitlistEntry } from "@/types";
import { businessDay, dateLabel } from "@/lib/utils";

const periodLabel = {
  any: "qualquer horário",
  morning: "manhã",
  afternoon: "tarde",
  evening: "noite",
} as const;

const firstName = (name: string) => name.trim().split(/\s+/)[0];
const serviceNames = (data: Store, ids: string[]) =>
  ids
    .map((id) => data.services.find((service) => service.id === id)?.name)
    .filter(Boolean)
    .join(" + ");

/** Tomorrow's bookings that still happen, earliest first. */
export function tomorrowReminders(data: Store, now = Date.now()) {
  const tomorrow = format(
    addDays(parseISO(businessDay(new Date(now))), 1),
    "yyyy-MM-dd",
  );
  return data.appointments
    .filter(
      (a) =>
        businessDay(a.start) === tomorrow &&
        (a.status === "confirmed" || a.status === "pending"),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function reminderMessage(data: Store, a: Appointment) {
  const professional = data.professionals.find(
    (person) => person.id === a.professionalId,
  );
  const when = dateLabel(a.start, "EEEE, dd/MM 'às' HH:mm");
  return [
    `Olá, ${firstName(a.customerName)}! Passando para lembrar do seu horário amanhã (${when})`,
    professional ? ` com ${firstName(professional.name)}` : "",
    ` na ${data.business.name}: ${serviceNames(data, a.serviceIds)}.`,
    " Se precisar remarcar, é só responder esta mensagem.",
  ].join("");
}

/** Waiting customers from today on; days with a cancellation come first. */
export function waitlistQueue(data: Store, now = Date.now()) {
  const today = businessDay(new Date(now));
  const cancelledDays = new Set(
    data.appointments
      .filter((a) => a.status === "cancelled")
      .map((a) => businessDay(a.start)),
  );
  return (data.waitlist ?? [])
    .filter((entry) => entry.desiredDate >= today)
    .map((entry) => ({
      entry,
      opening: cancelledDays.has(entry.desiredDate),
    }))
    .sort(
      (a, b) =>
        Number(b.opening) - Number(a.opening) ||
        a.entry.desiredDate.localeCompare(b.entry.desiredDate) ||
        a.entry.createdAt.localeCompare(b.entry.createdAt),
    );
}

export function waitlistMessage(
  data: Store,
  entry: WaitlistEntry,
  bookingUrl: string,
) {
  const day = format(parseISO(entry.desiredDate), "EEEE, dd/MM", {
    locale: ptBR,
  });
  return `Olá, ${firstName(entry.customerName)}! Aqui é da ${data.business.name}. Abriu um horário em ${day} para ${serviceNames(data, [entry.serviceId]) || "o seu serviço"}. Quer garantir? Agende aqui: ${bookingUrl}`;
}

export function waitlistWhen(entry: WaitlistEntry) {
  return `${format(parseISO(entry.desiredDate), "EEE, dd/MM", { locale: ptBR })} · ${periodLabel[entry.period]}`;
}
