import { format, isValid, parseISO } from "date-fns";
import { businessDay, dateLabel } from "@/lib/utils";
import type { Appointment, Professional, Store } from "@/types";

export type AgendaView = "day" | "week" | "month";
export const minuteOf = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};
export const timeOf = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
export const appointmentMinute = (value: string) =>
  minuteOf(dateLabel(value, "HH:mm"));
export function validAgendaDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value
    ? parsed
    : null;
}
export function appointmentServices(data: Store, appointment: Appointment) {
  return appointment.serviceIds
    .map((id) => data.services.find((service) => service.id === id)?.name)
    .filter(Boolean)
    .join(" + ");
}
export function appointmentsOn(appointments: Appointment[], day: string) {
  return appointments
    .filter((appointment) => businessDay(appointment.start) === day)
    .sort((a, b) => a.start.localeCompare(b.start));
}
export function workingRange(
  data: Store,
  professional: Professional,
  date: Date,
) {
  if (
    !data.settings.openDays.includes(date.getDay()) ||
    !professional.days.includes(date.getDay())
  )
    return null;
  const start = Math.max(
    minuteOf(data.settings.openStart),
    minuteOf(professional.start),
  );
  const end = Math.min(
    minuteOf(data.settings.openEnd),
    minuteOf(professional.end),
  );
  return end > start ? { start, end } : null;
}
