import { businessDay } from "@/lib/utils";
import type { Store } from "@/types";

const monthOf = (value: string | Date) => businessDay(value).slice(0, 7);

/** "2026-10" → "2026-09". */
export function previousMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  return value === 1
    ? `${year - 1}-12`
    : `${year}-${String(value - 1).padStart(2, "0")}`;
}

export function monthName(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, value - 1, 15)));
}

/**
 * Which month the owner sees: in the first week the month that just
 * closed, after that the current one so far.
 */
export function recapMonth(now: Date) {
  const today = businessDay(now);
  const month = today.slice(0, 7);
  return Number(today.slice(8, 10)) <= 7
    ? { month: previousMonth(month), closed: true }
    : { month, closed: false };
}

const localTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));

const localWeekday = (value: string) =>
  new Date(`${businessDay(value)}T12:00:00Z`).getUTCDay();

function top<T extends string>(values: T[]) {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
}

/** Everything the month recap shows, from the data the shop already has. */
export function monthRecap(store: Store, month: string) {
  const inMonth = (value: string) => monthOf(value) === month;
  const before = previousMonth(month);
  const visits = store.appointments.filter((a) => inMonth(a.start));
  const completed = visits.filter((a) => a.status === "completed");
  const noShows = visits.filter((a) => a.status === "no_show").length;
  const lastCompleted = store.appointments.filter(
    (a) => monthOf(a.start) === before && a.status === "completed",
  ).length;
  const revenue =
    store.payments
      .filter((p) => inMonth(p.createdAt))
      .reduce((sum, p) => sum + p.amount, 0) +
    (store.productSales || [])
      .filter((sale) => sale.status === "paid" && inMonth(sale.createdAt))
      .reduce((sum, sale) => sum + sale.total, 0);
  // Booked by the customer or the assistant, not typed in by the team.
  const booked = store.appointments.filter(
    (a) => inMonth(a.createdAt) && a.status !== "cancelled",
  );
  const online = booked.filter(
    (a) =>
      a.bookingChannel === "public_link" ||
      a.bookingChannel?.startsWith("assistant_"),
  );
  const assistant = online.filter((a) =>
    a.bookingChannel?.startsWith("assistant_"),
  ).length;
  const { openDays, openStart, openEnd } = store.settings;
  const afterHours = online.filter((a) => {
    const time = localTime(a.createdAt);
    return (
      !openDays.includes(localWeekday(a.createdAt)) ||
      time < openStart ||
      time >= openEnd
    );
  }).length;
  const reminded = visits.filter(
    (a) => a.reminder && a.status !== "cancelled",
  ).length;
  const service = top(completed.flatMap((a) => a.serviceIds));
  const professional = top(completed.map((a) => a.professionalId));
  const regular = top(completed.map((a) => a.customerId));
  const reviews = (store.reviews || []).filter((r) => inMonth(r.createdAt));
  const newCustomers = store.customers.filter((c) =>
    inMonth(c.createdAt),
  ).length;
  return {
    month,
    name: monthName(month),
    completed: completed.length,
    lastCompleted,
    growth: lastCompleted
      ? Math.round(((completed.length - lastCompleted) / lastCompleted) * 100)
      : null,
    revenue,
    ticket: completed.length
      ? completed.reduce((sum, a) => sum + a.price, 0) / completed.length
      : 0,
    online: online.length,
    assistant,
    afterHours,
    reminded,
    noShows,
    attendance:
      completed.length + noShows
        ? Math.round((completed.length / (completed.length + noShows)) * 100)
        : null,
    newCustomers,
    topService: service && {
      name: store.services.find((s) => s.id === service[0])?.name || "",
      count: service[1],
    },
    topProfessional: professional && {
      name:
        store.professionals.find((p) => p.id === professional[0])?.name || "",
      photo:
        store.professionals.find((p) => p.id === professional[0])?.photo || "",
      count: professional[1],
    },
    regular: regular &&
      regular[1] >= 2 && {
        name:
          store.customers.find((c) => c.id === regular[0])?.name.split(" ")[0] ||
          "",
        count: regular[1],
      },
    rating: reviews.length
      ? {
          average:
            reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
          count: reviews.length,
        }
      : null,
  };
}

export type MonthRecap = ReturnType<typeof monthRecap>;
