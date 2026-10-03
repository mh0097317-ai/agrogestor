const timeZone = "America/Sao_Paulo";
export function bookingDate(value: string | Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function bookingTime(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export function bookingDateLabel(value: string | Date, weekday = false) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "numeric",
    month: "long",
    ...(weekday ? { weekday: "long" as const } : {}),
  }).format(new Date(value));
}
export function bookingDateShort(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}
