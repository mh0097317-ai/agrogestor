import { DomainError } from "./availability";
import {
  validPeriod,
  inPeriod,
  type FinancePeriod,
} from "@/features/management/finance-helpers";
import type { Store } from "@/types";

export interface PlatformActivity {
  appointments: number;
  bookingCustomers: number;
  completed: number;
  cancelled: number;
  publicBookings: number;
  manualBookings: number;
  legacyBookings: number;
  assistantBookings: number;
  assistantCustomers: number;
  whatsappBookings: number;
  conversations: number;
  waitingHuman: number;
  received: number;
  assistantReceived: number;
  productReceived: number;
  bookedValue: number;
  turns: number;
  inputTokens: number;
  outputTokens: number;
}
export const emptyActivity = (): PlatformActivity => ({
  appointments: 0,
  bookingCustomers: 0,
  completed: 0,
  cancelled: 0,
  publicBookings: 0,
  manualBookings: 0,
  legacyBookings: 0,
  assistantBookings: 0,
  assistantCustomers: 0,
  whatsappBookings: 0,
  conversations: 0,
  waitingHuman: 0,
  received: 0,
  assistantReceived: 0,
  productReceived: 0,
  bookedValue: 0,
  turns: 0,
  inputTokens: 0,
  outputTokens: 0,
});
export type ActivityPeriod = FinancePeriod;
export function activityPeriod(
  from?: string | null,
  to?: string | null,
  now = new Date(),
): ActivityPeriod {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(now);
  const end = to || today;
  if (!validPeriod({ from: end, to: end }))
    throw new DomainError("Escolha um período válido.", 400);
  const start =
    from ||
    new Date(Date.parse(`${end}T12:00:00Z`) - 29 * 86400000)
      .toISOString()
      .slice(0, 10);
  if (
    !validPeriod({ from: start, to: end }) ||
    Date.parse(end) - Date.parse(start) > 365 * 86400000
  )
    throw new DomainError("Escolha um período válido de até 366 dias.", 400);
  return { from: start, to: end };
}
export function demoActivity(
  store: Store,
  period: ActivityPeriod,
): PlatformActivity {
  const result = emptyActivity();
  const created = store.appointments.filter((a) =>
    inPeriod(a.createdAt, period),
  );
  const active = created.filter((a) => a.status !== "cancelled");
  result.appointments = active.length;
  result.cancelled = created.length - active.length;
  result.bookingCustomers = new Set(active.map((a) => a.customerId)).size;
  result.completed = store.appointments.filter(
    (a) => a.status === "completed" && inPeriod(a.start, period),
  ).length;
  result.bookedValue = active.reduce((sum, a) => sum + a.price, 0);
  result.publicBookings = active.filter(
    (a) => a.bookingChannel === "public_link",
  ).length;
  result.manualBookings = active.filter(
    (a) => a.bookingChannel === "manual",
  ).length;
  result.legacyBookings = active.filter(
    (a) => !a.bookingChannel || a.bookingChannel === "legacy",
  ).length;
  result.assistantBookings = active.filter((a) =>
    a.bookingChannel?.startsWith("assistant_"),
  ).length;
  result.assistantCustomers = new Set(
    active
      .filter((a) => a.bookingChannel?.startsWith("assistant_"))
      .map((a) => a.customerId),
  ).size;
  result.whatsappBookings = active.filter(
    (a) => a.bookingChannel === "assistant_whatsapp",
  ).length;
  const paid = store.payments.filter((p) => inPeriod(p.createdAt, period));
  result.received = paid.reduce((sum, p) => sum + p.amount, 0);
  result.assistantReceived = paid
    .filter((p) =>
      store.appointments
        .find((a) => a.id === p.appointmentId)
        ?.bookingChannel?.startsWith("assistant_"),
    )
    .reduce((sum, p) => sum + p.amount, 0);
  result.productReceived = (store.productSales || [])
    .filter((s) => s.status === "paid" && inPeriod(s.createdAt, period))
    .reduce((sum, s) => sum + s.total, 0);
  result.received += result.productReceived;
  result.conversations = (store.conversations || []).filter((c) =>
    c.messages.some(
      (m) => m.role === "customer" && inPeriod(m.createdAt, period),
    ),
  ).length;
  result.waitingHuman = (store.conversations || []).filter(
    (c) => c.status === "human",
  ).length;
  return result;
}
