import type { Store } from "@/types";
import { businessDay } from "./utils";

/** Three independent facts in the period, not predicted revenue or a conversion rate. */
export function assistantImpact(data: Store, from: string, to: string) {
  const inside = (at: string) => {
    const day = businessDay(at);
    return day >= from && day <= to;
  };
  const bookings = data.appointments.filter(
    (item) =>
      item.businessId === data.business.id &&
      item.bookingChannel?.startsWith("assistant_") &&
      !["cancelled", "no_show"].includes(item.status),
  );
  const ids = new Set(bookings.map((item) => item.id));
  const payments = new Map(
    data.payments
      .filter(
        (item) =>
          item.businessId === data.business.id &&
          ids.has(item.appointmentId) &&
          inside(item.createdAt),
      )
      .map((item) => [item.id, item]),
  );
  return {
    created: bookings.filter((item) => inside(item.createdAt)).length,
    completed: bookings.filter(
      (item) => item.status === "completed" && inside(item.start),
    ).length,
    received: [...payments.values()].reduce(
      (sum, item) => sum + item.amount,
      0,
    ),
  };
}
