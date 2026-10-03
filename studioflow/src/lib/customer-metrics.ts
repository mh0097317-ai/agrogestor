import { differenceInCalendarDays, parseISO } from "date-fns";
import { businessDay } from "@/lib/utils";
import type { Customer } from "@/types";

export function customerDays(date?: string, now: string | Date = new Date()) {
  return date
    ? Math.max(
        0,
        differenceInCalendarDays(
          parseISO(businessDay(now)),
          parseISO(businessDay(date)),
        ),
      )
    : undefined;
}
export function customerNeedsReturn(
  customer: Customer,
  now: string | Date = new Date(),
) {
  const days = customerDays(customer.lastVisit, now);
  return (
    days !== undefined &&
    !!customer.returnInterval &&
    days > customer.returnInterval * 1.5
  );
}
export function customerVisitLabel(customer: Customer) {
  const days = customerDays(customer.lastVisit);
  return days === undefined
    ? "Sem visita concluída"
    : days === 0
      ? "Hoje"
      : days === 1
        ? "Há 1 dia"
        : `Há ${days} dias`;
}
