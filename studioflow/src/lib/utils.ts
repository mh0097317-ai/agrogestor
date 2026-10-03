import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
/** Human duration for clients: "40 minutos", "1 hora", "1h30". */
export function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest) return `${hours}h${String(rest).padStart(2, "0")}`;
  return hours === 1 ? "1 hora" : `${hours} horas`;
}
/** Brazilian phone for display: (11) 98765-4321. */
export function formatPhone(value: string) {
  const d = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11)
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value;
}
export const money = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function businessDay(value: string | Date = new Date()) {
  // A plain calendar date already is a business day; parsing it as UTC
  // midnight would shift it to the previous day in São Paulo.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function businessToday() {
  return parseISO(businessDay());
}
export function dateLabel(value: string | Date, pattern = "dd MMM, yyyy") {
  let date: Date;
  if (typeof value === "string" && value.includes("T")) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(value));
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    date = new Date(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
  } else date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern, { locale: ptBR });
}
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
export const statusLabels: Record<string, string> = {
  confirmed: "Confirmado",
  pending: "Aguardando",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Faltou",
};
export const paymentLabels: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  credit: "Crédito",
  debit: "Débito",
  other: "Outros",
};
export function localDay(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}
