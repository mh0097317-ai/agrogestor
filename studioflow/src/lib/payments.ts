import type {
  Appointment,
  Membership,
  MembershipPlan,
  Settings,
  Store,
} from "@/types";
import { chooseProfessional } from "./availability";

/** Smallest charge the provider accepts. */
export const minimumCharge = 5;

const cents = (value: number) => Math.round(value * 100) / 100;

/**
 * Deposit asked for a booking of `price`: fixed value or percent, never more
 * than the price and never below the provider minimum (then no deposit).
 */
export function depositFor(
  settings: Pick<Settings, "depositMode" | "depositValue">,
  price: number,
) {
  if (!settings.depositMode || settings.depositMode === "off") return 0;
  const raw =
    settings.depositMode === "fixed"
      ? settings.depositValue
      : (price * settings.depositValue) / 100;
  const amount = cents(Math.min(price, Math.max(minimumCharge, raw)));
  return price >= minimumCharge && amount >= minimumCharge ? amount : 0;
}

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

/** CPF with valid check digits (and not a repeated digit). */
export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index++)
      sum += Number(cpf[index]) * (length + 1 - index);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function formatCpf(value: string) {
  const cpf = onlyDigits(value).slice(0, 11);
  return cpf
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** yyyy-MM in São Paulo. */
export function monthKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(value));
}

const holding = new Set(["confirmed", "pending", "in_progress", "completed"]);

/** Pending holds past their deadline: the slot is free again. */
export function isExpiredHold(appointment: Appointment, now = new Date()) {
  return (
    appointment.status === "pending" &&
    appointment.depositStatus === "pending" &&
    !!appointment.depositExpiresAt &&
    new Date(appointment.depositExpiresAt).getTime() < now.getTime()
  );
}

/** Same rule as `private.expire_holds`. */
export function expireHolds(store: Store, now = new Date()) {
  let count = 0;
  for (const appointment of store.appointments)
    if (isExpiredHold(appointment, now)) {
      appointment.status = "cancelled";
      appointment.depositStatus = "expired";
      count++;
    }
  return count;
}

/** Same rule as `public.hold_for_deposit`. */
export function holdDeposit(
  appointment: Appointment,
  amount: number,
  minutes: number,
  now = new Date(),
) {
  if (
    appointment.status !== "confirmed" ||
    appointment.depositStatus ||
    appointment.membershipId ||
    amount <= 0
  )
    throw new Error("invalid deposit");
  appointment.status = "pending";
  appointment.depositAmount = cents(Math.min(amount, appointment.price));
  appointment.depositStatus = "pending";
  appointment.depositExpiresAt = new Date(
    now.getTime() + minutes * 60_000,
  ).toISOString();
}

/** Same rule as `public.confirm_deposit`. */
export function confirmDeposit(
  store: Store,
  chargeId: string,
  paymentId: string,
  now = new Date(),
): "unknown" | "already" | "confirmed" | "refund" {
  expireHolds(store, now);
  const appointment = store.appointments.find(
    (item) => item.depositChargeId === chargeId,
  );
  if (!appointment) return "unknown";
  if (appointment.depositStatus === "paid") return "already";
  let outcome: "confirmed" | "refund";
  if (
    appointment.status === "pending" &&
    appointment.depositStatus === "pending"
  )
    outcome = "confirmed";
  else {
    let free = false;
    if (
      appointment.depositStatus === "expired" &&
      appointment.status === "cancelled" &&
      new Date(appointment.start).getTime() > now.getTime()
    )
      try {
        chooseProfessional(
          store,
          appointment.serviceIds,
          appointment.professionalId,
          appointment.start,
          appointment.id,
          true,
        );
        free = true;
      } catch {
        free = false;
      }
    outcome = free ? "confirmed" : "refund";
  }
  if (outcome === "confirmed") appointment.status = "confirmed";
  appointment.depositStatus = "paid";
  if (!store.payments.some((payment) => payment.providerChargeId === chargeId))
    store.payments.push({
      id: paymentId,
      businessId: appointment.businessId,
      appointmentId: appointment.id,
      amount: appointment.depositAmount || 0,
      method: "pix",
      createdAt: now.toISOString(),
      providerChargeId: chargeId,
    });
  return outcome;
}

/** Club visits in the São Paulo month of `start`. */
export function membershipUsage(
  appointments: Appointment[],
  membershipId: string,
  start: string,
  excludeId?: string,
) {
  const month = monthKey(start);
  return appointments.filter(
    (item) =>
      item.membershipId === membershipId &&
      item.id !== excludeId &&
      holding.has(item.status) &&
      monthKey(item.start) === month,
  ).length;
}

export type CoverageResult =
  | "covered"
  | "invalid"
  | "inactive"
  | "phone"
  | "services"
  | "limit";

/** Whether the plan covers these services in the month of `start`. */
export function planCovers(
  plan: Pick<MembershipPlan, "serviceIds" | "monthlyLimit">,
  serviceIds: string[],
  used: number,
): Exclude<CoverageResult, "invalid" | "inactive" | "phone"> {
  if (!serviceIds.every((id) => plan.serviceIds.includes(id)))
    return "services";
  if (plan.monthlyLimit != null && used >= plan.monthlyLimit) return "limit";
  return "covered";
}

/** Same rule as `public.apply_membership`. */
export function applyMembership(
  store: Store,
  appointment: Appointment,
  membership: Membership | undefined,
): CoverageResult {
  if (appointment.membershipId) return "covered";
  if (appointment.status !== "confirmed" || appointment.depositStatus)
    return "invalid";
  if (!membership || membership.businessId !== appointment.businessId)
    return "invalid";
  if (membership.status !== "active") return "inactive";
  if (membership.customerPhone !== appointment.customerPhone) return "phone";
  const plan = store.plans?.find((item) => item.id === membership.planId);
  if (!plan) return "invalid";
  const result = planCovers(
    plan,
    appointment.serviceIds,
    membershipUsage(
      store.appointments,
      membership.id,
      appointment.start,
      appointment.id,
    ),
  );
  if (result !== "covered") return result;
  appointment.membershipId = membership.id;
  appointment.price = 0;
  return "covered";
}

export const coverageMessages: Record<
  Exclude<CoverageResult, "covered">,
  string
> = {
  invalid: "Não encontramos sua assinatura do clube.",
  inactive:
    "Sua assinatura do clube não está ativa. Confira o pagamento para usar o clube.",
  phone: "Use o mesmo WhatsApp da assinatura para agendar pelo clube.",
  services: "Este serviço não faz parte do seu plano.",
  limit: "Você já usou todos os atendimentos do clube neste mês.",
};

/** Money that recurs every month from active subscriptions. */
export function monthlyRecurring(memberships: Membership[]) {
  return cents(
    memberships
      .filter((item) => item.status === "active" || item.status === "overdue")
      .reduce((sum, item) => sum + item.price, 0),
  );
}
