import { businessDay } from "./utils";
import {
  cents,
  inPeriod,
  validPeriod,
} from "@/features/management/finance-helpers";
import type { Store, Appointment } from "@/types";
import { DomainError } from "./availability";

export function weeklyPeriod(week?: string, now = new Date()) {
  const day = week || businessDay(now);
  if (!validPeriod({ from: day, to: day }))
    throw new DomainError("Selecione uma semana válida.");
  const start = new Date(`${day}T12:00:00Z`);
  const offset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - offset - (week ? 0 : 7));
  const from = start.toISOString().slice(0, 10);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { from, to: end.toISOString().slice(0, 10) };
}
export function weeklyScope(store: Store, requested?: string) {
  const role = store.viewer?.role;
  if (!["owner", "admin", "manager", "professional"].includes(role || ""))
    throw new DomainError(
      "Este relatório está disponível para a gestão e os profissionais.",
      403,
    );
  const own = store.viewer?.professionalId;
  if (role === "professional" && (!own || (requested && requested !== own)))
    throw new DomainError("Você pode consultar somente o seu relatório.", 403);
  const id = role === "professional" ? own : requested;
  if (
    id &&
    !store.professionals.some(
      (p) => p.id === id && p.businessId === store.business.id,
    )
  )
    throw new DomainError("Profissional não encontrado.", 404);
  return id;
}
export interface WeeklyReceipt {
  businessId: string;
  professionalId: string;
  amount: number;
  createdAt: string;
}
export interface WeeklySale {
  businessId: string;
  total: number;
  status: string;
  createdAt: string;
}
export function weeklySummary(
  store: Store,
  week: string | undefined,
  professionalId: string | undefined,
  appointments: Appointment[],
  receipts: WeeklyReceipt[],
  sales: WeeklySale[],
  now = new Date(),
) {
  const period = weeklyPeriod(week, now);
  const relevant = appointments.filter(
    (a) =>
      a.businessId === store.business.id &&
      (!professionalId || a.professionalId === professionalId) &&
      inPeriod(a.start, period),
  );
  const paid = receipts.filter(
    (p) =>
      p.businessId === store.business.id &&
      (!professionalId || p.professionalId === professionalId) &&
      inPeriod(p.createdAt, period),
  );
  const products = professionalId
    ? []
    : sales.filter(
        (s) =>
          s.businessId === store.business.id &&
          s.status === "paid" &&
          inPeriod(s.createdAt, period),
      );
  const completed = relevant.filter((a) => a.status === "completed");
  const missed = relevant.filter((a) => a.status === "no_show").length;
  const professionals = store.professionals
    .filter(
      (p) =>
        p.businessId === store.business.id &&
        (!professionalId || p.id === professionalId),
    )
    .map((p) => {
      const received = paid
        .filter((r) => r.professionalId === p.id)
        .reduce((s, r) => s + cents(r.amount), 0);
      return {
        name: p.name,
        completed: completed.filter((a) => a.professionalId === p.id).length,
        received,
        commission: Math.round((received * p.commission) / 100),
      };
    });
  const received = paid.reduce((s, r) => s + cents(r.amount), 0);
  const productReceived = products.reduce((s, r) => s + cents(r.total), 0);
  return {
    ...period,
    businessName: store.business.name,
    audience: professionalId ? ("professional" as const) : ("owner" as const),
    professionalName: professionals[0]?.name || "Profissional",
    demo: store.mode === "demo",
    checkedAt: now.toISOString(),
    received,
    productReceived,
    totalReceived: received + productReceived,
    completed: completed.length,
    missed,
    cancelled: relevant.filter((a) => a.status === "cancelled").length,
    customers: new Set(completed.map((a) => a.customerId).filter(Boolean)).size,
    attendance:
      completed.length + missed
        ? Math.round((completed.length * 100) / (completed.length + missed))
        : null,
    professionals,
    services: store.services
      .filter((s) => s.businessId === store.business.id)
      .map((s) => ({
        name: s.name,
        count: completed.filter((a) => a.serviceIds.includes(s.id)).length,
      }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count),
    days: Array.from({ length: 7 }, (_, i) => {
      const day = new Date(`${period.from}T12:00:00Z`);
      day.setUTCDate(day.getUTCDate() + i);
      const date = day.toISOString().slice(0, 10);
      return {
        date,
        completed: completed.filter((a) => businessDay(a.start) === date)
          .length,
        received:
          paid
            .filter((p) => businessDay(p.createdAt) === date)
            .reduce((s, p) => s + cents(p.amount), 0) +
          products
            .filter((p) => businessDay(p.createdAt) === date)
            .reduce((s, p) => s + cents(p.total), 0),
      };
    }),
  };
}
export type WeeklyReport = ReturnType<typeof weeklySummary>;
