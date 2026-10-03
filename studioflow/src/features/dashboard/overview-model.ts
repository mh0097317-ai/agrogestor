import type { Store } from "@/types";
import { availableSlots } from "@/lib/availability";
import { businessDay } from "@/lib/utils";
import { customerNeedsReturn } from "@/lib/customer-metrics";
export function overviewModel(data: Store, day: string, now: number) {
  const appointments = data.appointments
    .filter((a) => businessDay(a.start) === day && a.status !== "cancelled")
    .sort((a, b) => a.start.localeCompare(b.start));
  const expected = appointments.filter((a) => a.status !== "no_show");
  const collected = data.payments
    .filter((p) => businessDay(p.createdAt) === day)
    .reduce((sum, p) => sum + p.amount, 0);
  const completed = appointments.filter((a) => a.status === "completed").length;
  const pending = appointments.filter((a) => a.status === "pending");
  const unfinished = expected.filter((a) => a.status !== "completed");
  const next =
    unfinished.find((a) => a.status === "in_progress") ||
    unfinished.find(
      (a) =>
        day !== businessDay(new Date(now)) || new Date(a.end).getTime() > now,
    );
  const service = data.services.find(
    (s) =>
      s.active &&
      s.professionalIds.some((id) =>
        data.professionals.some((p) => p.id === id && p.active),
      ),
  );
  const freeSlots = service
    ? availableSlots(data, [service.id], "any", day, new Date(now)).length
    : 0;
  const overdue = data.customers.filter((c) =>
    customerNeedsReturn(c, new Date(now)),
  );
  const revenue = expected.reduce((sum, a) => sum + a.price, 0);
  return {
    appointments,
    next,
    pending,
    overdue,
    completed,
    collected,
    service,
    freeSlots,
    revenue,
    ticket: expected.length ? revenue / expected.length : 0,
    newCustomers: data.customers.filter((c) => businessDay(c.createdAt) === day)
      .length,
  };
}
