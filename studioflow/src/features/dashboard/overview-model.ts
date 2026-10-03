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
  // Free slots are counted for the shortest bookable service, the most
  // permissive measure of how much room is left in the day.
  const service = data.services
    .filter(
      (s) =>
        s.active &&
        s.professionalIds.some((id) =>
          data.professionals.some((p) => p.id === id && p.active),
        ),
    )
    .sort((a, b) => a.duration - b.duration)[0];
  const freeSlots = service
    ? availableSlots(data, [service.id], "any", day, new Date(now)).length
    : 0;
  const overdue = data.customers.filter((c) =>
    customerNeedsReturn(c, new Date(now)),
  );
  const revenue = expected.reduce((sum, a) => sum + a.price, 0);
  const attended = appointments.filter(
    (a) => a.status === "completed" || a.status === "in_progress",
  ).length;
  const noShows = appointments.filter((a) => a.status === "no_show").length;
  const upcoming =
    day === businessDay(new Date(now))
      ? unfinished.filter(
          (a) => a.status === "in_progress" || new Date(a.end).getTime() > now,
        )
      : unfinished;
  return {
    appointments,
    next,
    upcoming,
    attended,
    attendanceRate:
      attended + noShows ? attended / (attended + noShows) : undefined,
    pending,
    overdue,
    completed,
    collected,
    service,
    freeSlots,
    revenue,
    ticket: expected.length ? revenue / expected.length : 0,
    // Date-only values are already business days; timestamps are converted.
    newCustomers: data.customers.filter(
      (c) =>
        (c.createdAt.length === 10 ? c.createdAt : businessDay(c.createdAt)) ===
        day,
    ).length,
  };
}
