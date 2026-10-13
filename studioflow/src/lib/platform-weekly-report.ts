import { weeklyPeriod, type WeeklyReport } from "./weekly-report";
import { businessDay } from "./utils";
import { cents, inPeriod } from "@/features/management/finance-helpers";
import { accessOpen, type BusinessAccess } from "./access";
import type { AdminInvoice } from "./platform-reporting";
export function platformWeeklySummary(
  businesses: {
    id: string;
    name: string;
    status: BusinessAccess["status"];
    until: string | null;
    createdAt: string;
  }[],
  invoices: AdminInvoice[],
  week?: string,
  now = new Date(),
  demo = false,
) {
  const period = weeklyPeriod(week, now),
    today = businessDay(now);
  const paid = invoices.filter(
    (i) => i.status === "paid" && i.paidAt && inPeriod(i.paidAt, period),
  );
  const received = paid.reduce((s, i) => s + cents(i.value), 0);
  const report: WeeklyReport & {
    platform: true;
    newBusinesses: number;
    overdueCents: number;
  } = {
    ...period,
    platform: true,
    businessName: "StudioFlow - Plataforma",
    audience: "owner",
    professionalName: "",
    demo,
    checkedAt: now.toISOString(),
    received,
    totalReceived: received,
    productReceived: 0,
    completed: paid.length,
    missed: 0,
    cancelled: businesses.filter((b) => b.status === "suspended").length,
    customers: businesses.filter((b) => accessOpen(b, now)).length,
    attendance: null,
    newBusinesses: businesses.filter((b) => inPeriod(b.createdAt, period))
      .length,
    overdueCents: invoices
      .filter((i) => i.status === "pending" && i.dueDate < today)
      .reduce((s, i) => s + cents(i.value), 0),
    professionals: businesses.map((b) => ({
      name: b.name,
      completed: paid.filter((i) => i.businessId === b.id).length,
      received: paid
        .filter((i) => i.businessId === b.id)
        .reduce((s, i) => s + cents(i.value), 0),
      commission: 0,
    })),
    services: [
      {
        name: "Ativas",
        count: businesses.filter((b) => accessOpen(b, now)).length,
      },
      {
        name: "Aguardando liberação",
        count: businesses.filter((b) => b.status === "pending").length,
      },
      {
        name: "Pausadas",
        count: businesses.filter((b) => b.status === "suspended").length,
      },
    ],
    days: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${period.from}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      const rows = paid.filter((p) => businessDay(p.paidAt!) === date);
      return {
        date,
        completed: rows.length,
        received: rows.reduce((s, r) => s + cents(r.value), 0),
      };
    }),
  };
  return report;
}
