import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Store } from "@/types";
import { businessDay } from "@/lib/utils";
import { customerDays, customerNeedsReturn } from "@/lib/customer-metrics";

const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
};
const counts = (status: string) =>
  status !== "cancelled" && status !== "no_show";

/** Received (payments) and expected (bookings) per day, ending on `day`. */
export function weekRevenue(data: Store, day: string) {
  const end = parseISO(day);
  const days = Array.from({ length: 7 }, (_, i) =>
    format(addDays(end, i - 6), "yyyy-MM-dd"),
  );
  const rows = days.map((date) => ({
    date,
    label: format(parseISO(date), "EEEEEE", { locale: ptBR }),
    received: data.payments
      .filter((p) => businessDay(p.createdAt) === date)
      .reduce((sum, p) => sum + p.amount, 0),
    expected: data.appointments
      .filter((a) => businessDay(a.start) === date && counts(a.status))
      .reduce((sum, a) => sum + a.price, 0),
  }));
  const total = rows.reduce((sum, row) => sum + row.received, 0);
  const previousStart = format(addDays(end, -13), "yyyy-MM-dd");
  const previousEnd = format(addDays(end, -7), "yyyy-MM-dd");
  const previous = data.payments
    .filter((p) => {
      const date = businessDay(p.createdAt);
      return date >= previousStart && date <= previousEnd;
    })
    .reduce((sum, p) => sum + p.amount, 0);
  return {
    rows,
    total,
    change: previous > 0 ? (total - previous) / previous : undefined,
  };
}

/** Share of each working professional's day already booked. */
export function occupancy(data: Store, day: string) {
  const weekday = parseISO(day).getDay();
  return data.professionals
    .filter((p) => p.active && p.days.includes(weekday))
    .map((p) => {
      const lunch =
        p.breakStart && p.breakEnd
          ? Math.max(0, minutes(p.breakEnd) - minutes(p.breakStart))
          : 0;
      const available = Math.max(0, minutes(p.end) - minutes(p.start) - lunch);
      const booked = data.appointments.filter(
        (a) =>
          a.professionalId === p.id &&
          businessDay(a.start) === day &&
          counts(a.status),
      );
      const bookedMinutes = booked.reduce(
        (sum, a) =>
          sum +
          (new Date(a.end).getTime() - new Date(a.start).getTime()) / 60000,
        0,
      );
      return {
        professional: p,
        count: booked.length,
        ratio: available ? Math.min(1, bookedMinutes / available) : 0,
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/** Things the owner can act on now: pending bookings and lapsed clients. */
export function attention(data: Store, now: number, limit = 3) {
  const pending = data.appointments
    .filter((a) => a.status === "pending" && new Date(a.end).getTime() > now)
    .sort((a, b) => a.start.localeCompare(b.start));
  const lapsed = data.customers
    .filter((c) => customerNeedsReturn(c, new Date(now)))
    .map((c) => ({
      customer: c,
      days: customerDays(c.lastVisit, new Date(now)) ?? 0,
    }))
    .sort((a, b) => b.days - a.days);
  return {
    pending: pending.slice(0, limit),
    pendingTotal: pending.length,
    lapsed: lapsed.slice(0, limit),
    lapsedTotal: lapsed.length,
  };
}
