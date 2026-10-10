import { getWorkspace } from "./server-store";
import { createSupabaseAdmin, requireMembership } from "@/lib/supabase/server";
import { isDemo } from "./server-demo";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@/lib/availability";
import {
  commercialImpact,
  type CommercialReport,
  type ImpactAppointment,
} from "@/lib/commercial-impact";
import { validPeriod } from "@/features/management/finance-helpers";

async function pages<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; start < 500_000; start += 1000) {
    const result = await query(start, start + 999);
    if (result.error || !result.data)
      throw new DomainError(
        "Não foi possível conferir todos os registros do período. Tente novamente.",
        503,
      );
    rows.push(...result.data);
    if (result.data.length < 1000) return rows;
  }
  throw new DomainError(
    "Histórico muito extenso. Selecione um período menor.",
    422,
  );
}

export async function commercialReport(
  from: string,
  to: string,
): Promise<CommercialReport> {
  if (!validPeriod({ from, to }))
    throw new DomainError("Selecione um período válido.");
  const demo = isDemo();
  const store = demo ? await getWorkspace() : null;
  const membership = demo ? null : await requireMembership();
  const role = store?.viewer?.role || membership?.role || "";
  if (!["owner", "admin", "manager"].includes(role))
    throw new DomainError(
      "Somente a gestão pode consultar os resultados comerciais.",
      403,
    );
  const checkedAt = new Date().toISOString();
  const businessId = store?.business.id || membership!.businessId;
  if (store)
    return {
      businessId,
      from,
      to,
      checkedAt,
      demo: true,
      ...commercialImpact(
        {
          businessId,
          appointments: store.appointments,
          payments: store.payments,
        },
        from,
        to,
      ),
    };
  return {
    businessId,
    from,
    to,
    checkedAt,
    demo: false,
    ...(await queryCommercialImpact(
      createSupabaseAdmin(),
      businessId,
      from,
      to,
    )),
  };
}

/** Scope is supplied only by the authenticated membership above. All reads are paginated. */
export async function queryCommercialImpact(
  client: SupabaseClient,
  businessId: string,
  from: string,
  to: string,
) {
  const start = `${from}T00:00:00-03:00`;
  // All-time preset has no finite upper boundary; otherwise use an exclusive next day.
  const end =
    to === "9999-12-31"
      ? null
      : new Date(Date.parse(`${to}T00:00:00-03:00`) + 86400000).toISOString();
  const fields = "id,business_id,booking_channel,created_at,start,status";
  type BookingRow = {
    id: string;
    business_id: string;
    booking_channel: ImpactAppointment["bookingChannel"];
    created_at: string;
    start: string;
    status: ImpactAppointment["status"];
  };
  type PaymentRow = {
    id: string;
    business_id: string;
    appointment_id: string;
    amount: number;
    created_at: string;
  };
  const [bookings, receipts] = await Promise.all([
    pages<BookingRow>((lo, hi) =>
      client
        .from("appointments")
        .select(fields)
        .eq("business_id", businessId)
        .or(
          end
            ? `and(created_at.gte.${start},created_at.lt.${end}),and(start.gte.${start},start.lt.${end})`
            : `created_at.gte.${start},start.gte.${start}`,
        )
        .order("id")
        .range(lo, hi),
    ),
    pages<PaymentRow>((lo, hi) => {
      let query = client
        .from("payments")
        .select("id,business_id,appointment_id,amount,created_at")
        .eq("business_id", businessId)
        .gte("created_at", start);
      if (end) query = query.lt("created_at", end);
      return query.order("id").range(lo, hi);
    }),
  ]);
  const ids = new Set(bookings.map((a) => a.id));
  const missing = [...new Set(receipts.map((p) => p.appointment_id))].filter(
    (id) => !ids.has(id),
  );
  // A payment can arrive this month for a booking created and attended earlier.
  for (let i = 0; i < missing.length; i += 200) {
    const { data, error } = await client
      .from("appointments")
      .select(fields)
      .eq("business_id", businessId)
      .in("id", missing.slice(i, i + 200));
    if (error || !data)
      throw new DomainError(
        "Não foi possível conferir a origem dos recebimentos.",
        503,
      );
    bookings.push(...(data as BookingRow[]));
  }
  return commercialImpact(
    {
      businessId,
      appointments: bookings.map((a) => ({
        id: a.id,
        businessId: a.business_id,
        bookingChannel: a.booking_channel,
        createdAt: a.created_at,
        start: a.start,
        status: a.status,
      })),
      payments: receipts.map((p) => ({
        id: p.id,
        businessId: p.business_id,
        appointmentId: p.appointment_id,
        amount: Number(p.amount),
        createdAt: p.created_at,
      })),
    },
    from,
    to,
  );
}
