import { businessDay } from "@/lib/utils";
import type { Appointment, PaymentMethod, Store } from "@/types";

export type FinancePreset = "today" | "week" | "month" | "all" | "custom";
export interface FinancePeriod {
  from: string;
  to: string;
}
export function periodFor(
  preset: FinancePreset,
  now = new Date(),
): FinancePeriod {
  const today = businessDay(now);
  if (preset === "all") return { from: "0001-01-01", to: "9999-12-31" };
  if (preset === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === "week") {
    const start = new Date(`${today}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 6);
    return { from: start.toISOString().slice(0, 10), to: today };
  }
  return { from: today, to: today };
}
export function validPeriod(period: FinancePeriod) {
  const valid = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(new Date(`${date}T12:00:00Z`).getTime()) &&
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
  return valid(period.from) && valid(period.to) && period.from <= period.to;
}
export function inPeriod(value: string, period: FinancePeriod) {
  if (!validPeriod(period)) return false;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : businessDay(value);
  return day >= period.from && day <= period.to;
}
export const cents = (value: number) => Math.round(value * 100);
export const reais = (value: number) => value / 100;
export function balanceFor(appointment: Appointment, data: Store) {
  const paid = data.payments
    .filter((payment) => payment.appointmentId === appointment.id)
    .reduce((sum, payment) => sum + cents(payment.amount), 0);
  return Math.max(0, cents(appointment.price) - paid);
}
export function financeSummary(data: Store, period: FinancePeriod) {
  const appointmentById = new Map(
    data.appointments.map((appointment) => [appointment.id, appointment]),
  );
  const payments = data.payments
    .filter((payment) => inPeriod(payment.createdAt, period))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const appointments = data.appointments.filter((appointment) =>
    inPeriod(appointment.start, period),
  );
  const completed = appointments.filter(
    (appointment) => appointment.status === "completed",
  );
  const outstanding = completed
    .map((appointment) => ({
      appointment,
      dueCents: balanceFor(appointment, data),
    }))
    .filter((item) => item.dueCents > 0)
    .sort((a, b) => a.appointment.start.localeCompare(b.appointment.start));
  const revenueCents = payments.reduce(
    (sum, payment) => sum + cents(payment.amount),
    0,
  );
  const paidCount = new Set(payments.map((payment) => payment.appointmentId))
    .size;
  const closedCount = appointments.filter((appointment) =>
    ["completed", "no_show"].includes(appointment.status),
  ).length;
  const professionals = data.professionals
    .map((professional) => {
      const receipts = payments.filter(
        (payment) =>
          appointmentById.get(payment.appointmentId)?.professionalId ===
          professional.id,
      );
      const receivedCents = receipts.reduce(
        (sum, payment) => sum + cents(payment.amount),
        0,
      );
      return {
        professional,
        receivedCents,
        commissionCents: Math.round(
          (receivedCents * professional.commission) / 100,
        ),
        completedCount: completed.filter(
          (appointment) => appointment.professionalId === professional.id,
        ).length,
        paidCount: new Set(receipts.map((payment) => payment.appointmentId))
          .size,
      };
    })
    .sort(
      (a, b) =>
        b.receivedCents - a.receivedCents ||
        b.completedCount - a.completedCount,
    );
  const services = data.services
    .map((service) => ({
      service,
      count: completed.filter((appointment) =>
        appointment.serviceIds.includes(service.id),
      ).length,
    }))
    .filter((item) => item.count > 0)
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.service.name.localeCompare(b.service.name, "pt-BR"),
    );
  const methods: PaymentMethod[] = ["pix", "cash", "credit", "debit", "other"];
  const paymentMethods = methods.map((method) => ({
    method,
    amountCents: payments
      .filter((payment) => payment.method === method)
      .reduce((sum, payment) => sum + cents(payment.amount), 0),
  }));
  // Vendas de produtos: entram no caixa pela data da venda.
  const productSales = (data.productSales || []).filter(
    (sale) => sale.status === "paid" && inPeriod(sale.createdAt, period),
  );
  const productCents = productSales.reduce((sum, sale) => sum + cents(sale.total), 0);
  const productTotals = new Map<string, { name: string; quantity: number; amountCents: number }>();
  for (const item of productSales.flatMap((sale) => sale.items)) {
    const entry = productTotals.get(item.productId) || {
      name: item.name,
      quantity: 0,
      amountCents: 0,
    };
    entry.quantity += item.quantity;
    entry.amountCents += cents(item.price) * item.quantity;
    productTotals.set(item.productId, entry);
  }
  const productMethods = methods.map((method) => ({
    method,
    amountCents: productSales
      .filter((sale) => sale.method === method)
      .reduce((sum, sale) => sum + cents(sale.total), 0),
  }));
  return {
    appointments,
    completed,
    payments,
    outstanding,
    professionals,
    services,
    paymentMethods,
    revenueCents,
    productSales,
    productCents,
    productMethods,
    topProducts: [...productTotals.values()].sort(
      (a, b) => b.amountCents - a.amountCents || b.quantity - a.quantity,
    ),
    /** Serviços recebidos mais produtos vendidos. */
    cashCents: revenueCents + productCents,
    dueCents: outstanding.reduce((sum, item) => sum + item.dueCents, 0),
    commissionCents: professionals.reduce(
      (sum, item) => sum + item.commissionCents,
      0,
    ),
    averageTicketCents: completed.length
      ? Math.round(
          completed.reduce(
            (sum, appointment) => sum + cents(appointment.price),
            0,
          ) / completed.length,
        )
      : 0,
    averageReceiptCents: paidCount ? Math.round(revenueCents / paidCount) : 0,
    paidCount,
    clientsCount: new Set(
      completed.map((appointment) => appointment.customerId),
    ).size,
    attendance: closedCount ? (completed.length / closedCount) * 100 : null,
    newClients: data.customers.filter((customer) =>
      inPeriod(customer.createdAt, period),
    ).length,
    appointmentById,
  };
}
