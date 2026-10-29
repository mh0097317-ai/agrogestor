import type { SupabaseClient } from "@supabase/supabase-js";
import type { Appointment } from "@/types";
import { getWorkspace } from "./server-store";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  weeklyPeriod,
  weeklyScope,
  weeklySummary,
  type WeeklyReceipt,
  type WeeklySale,
} from "@/lib/weekly-report";
import { validPeriod } from "@/features/management/finance-helpers";
import { businessDay } from "@/lib/utils";
import { DomainError } from "@/lib/availability";

async function pages<T>(
  read: (
    lo: number,
    hi: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let lo = 0; lo < 20_000; lo += 1000) {
    const { data, error } = await read(lo, lo + 999);
    if (error || !data)
      throw new DomainError(
        "Não foi possível conferir todos os dados do relatório.",
        503,
      );
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
  throw new DomainError(
    "A semana tem registros demais para este relatório.",
    422,
  );
}
export async function queryWeeklyRows(
  client: SupabaseClient,
  businessId: string,
  week?: string,
  professionalId?: string,
  reportPeriod?: { from: string; to: string },
) {
  const { from, to } = reportPeriod ?? weeklyPeriod(week);
  const start = `${from}T00:00:00-03:00`;
  const end = new Date(
    Date.parse(`${to}T00:00:00-03:00`) + 86400000,
  ).toISOString();
  const appointments = await pages((lo, hi) => {
    let q = client
      .from("appointments")
      .select(
        "id,business_id,professional_id,customer_id,start,end,status,price,created_at,appointment_services(service_id)",
      )
      .eq("business_id", businessId)
      .gte("start", start)
      .lt("start", end);
    if (professionalId) q = q.eq("professional_id", professionalId);
    return q.order("id").range(lo, hi);
  });
  const receipts = await pages((lo, hi) => {
    let q = client
      .from("payments")
      .select(
        "business_id,amount,created_at,appointments!inner(business_id,professional_id)",
      )
      .eq("business_id", businessId)
      .eq("appointments.business_id", businessId)
      .gte("created_at", start)
      .lt("created_at", end);
    if (professionalId)
      q = q.eq("appointments.professional_id", professionalId);
    return q.order("id").range(lo, hi);
  });
  const sales = professionalId
    ? []
    : await pages((lo, hi) =>
        client
          .from("product_sales")
          .select("business_id,total,status,created_at")
          .eq("business_id", businessId)
          .eq("status", "paid")
          .gte("created_at", start)
          .lt("created_at", end)
          .order("id")
          .range(lo, hi),
      );
  return {
    appointments: appointments.map((a) => ({
      id: a.id,
      businessId: a.business_id,
      professionalId: a.professional_id,
      customerId: a.customer_id,
      start: a.start,
      end: a.end,
      status: a.status,
      price: Number(a.price),
      createdAt: a.created_at,
      serviceIds: a.appointment_services.map((s) => s.service_id),
    })) as Appointment[],
    receipts: receipts.map((p) => ({
      businessId: p.business_id,
      amount: Number(p.amount),
      createdAt: p.created_at,
      professionalId: (p.appointments as unknown as { professional_id: string })
        .professional_id,
    })) as WeeklyReceipt[],
    sales: sales.map((s) => ({
      businessId: s.business_id,
      total: Number(s.total),
      status: s.status,
      createdAt: s.created_at,
    })) as WeeklySale[],
  };
}
export async function weeklyReport(
  week?: string,
  requested?: string,
  reportPeriod?: { from: string; to: string },
) {
  const selectedWeek = reportPeriod?.from || weeklyPeriod(week).from;
  const store = await getWorkspace();
  const professionalId = weeklyScope(store, requested);
  if (store.mode === "demo") {
    const receipts = store.payments.map((p) => ({
      ...p,
      professionalId:
        store.appointments.find((a) => a.id === p.appointmentId)
          ?.professionalId || "",
    }));
    return weeklySummary(
      store,
      selectedWeek,
      professionalId,
      store.appointments,
      receipts,
      store.productSales || [],
      new Date(),
      reportPeriod,
    );
  }
  const rows = await queryWeeklyRows(
    createSupabaseAdmin(),
    store.business.id,
    selectedWeek,
    professionalId,
    reportPeriod,
  );
  return weeklySummary(
    store,
    selectedWeek,
    professionalId,
    rows.appointments,
    rows.receipts,
    rows.sales,
    new Date(),
    reportPeriod,
  );
}

export async function dailyReport(date = businessDay(), requested?: string) {
  if (!validPeriod({ from: date, to: date }))
    throw new DomainError("Selecione um dia válido.");
  return {
    ...(await weeklyReport(date, requested, { from: date, to: date })),
    daily: true,
  };
}
