import type { Appointment, Payment } from "@/types";
import { businessDay } from "./utils";

export const commercialChannels = [
  { key: "assistant_whatsapp", label: "Recepcionista · WhatsApp" },
  { key: "assistant_web", label: "Recepcionista · Site" },
  { key: "assistant_instagram", label: "Recepcionista · Instagram" },
  { key: "public_link", label: "Página de agendamento" },
  { key: "manual", label: "Equipe · Painel" },
  { key: "legacy", label: "Origem não registrada" },
] as const;
export type ImpactAppointment = Pick<
  Appointment,
  "id" | "businessId" | "bookingChannel" | "createdAt" | "start" | "status"
>;
export type ImpactPayment = Pick<
  Payment,
  "id" | "businessId" | "appointmentId" | "amount" | "createdAt"
>;
export interface CommercialNumbers {
  created: number;
  completed: number;
  cancelled: number;
  noShow: number;
  receivedCents: number;
}
export interface CommercialReport {
  businessId: string;
  from: string;
  to: string;
  checkedAt: string;
  demo: boolean;
  channels: (CommercialNumbers & { key: string; label: string })[];
  assistant: CommercialNumbers;
}

/** Independent observed facts: never equate creation, attendance and payment. */
export function commercialImpact(
  input: {
    businessId: string;
    appointments: ImpactAppointment[];
    payments: ImpactPayment[];
  },
  from: string,
  to: string,
) {
  const inside = (at: string) => {
    const day = businessDay(at);
    return day >= from && day <= to;
  };
  const appointments = new Map(
    input.appointments
      .filter((a) => a.businessId === input.businessId)
      .map((a) => [a.id, a]),
  );
  const payments = [
    ...new Map(
      input.payments
        .filter((p) => p.businessId === input.businessId && inside(p.createdAt))
        .map((p) => [p.id, p]),
    ).values(),
  ];
  const known = new Set<string>(commercialChannels.map((c) => c.key));
  const channel = (a: ImpactAppointment) =>
    known.has(a.bookingChannel || "") ? a.bookingChannel! : "legacy";
  const channels = commercialChannels.map((c) => {
    const own = [...appointments.values()].filter((a) => channel(a) === c.key);
    return {
      ...c,
      created: own.filter((a) => inside(a.createdAt)).length,
      completed: own.filter((a) => inside(a.start) && a.status === "completed")
        .length,
      cancelled: own.filter((a) => inside(a.start) && a.status === "cancelled")
        .length,
      noShow: own.filter((a) => inside(a.start) && a.status === "no_show")
        .length,
      receivedCents: payments
        .filter((p) => {
          const a = appointments.get(p.appointmentId);
          return a && channel(a) === c.key;
        })
        .reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0),
    };
  });
  const assistant = channels
    .filter((c) => c.key.startsWith("assistant_"))
    .reduce<CommercialNumbers>(
      (sum, c) => ({
        created: sum.created + c.created,
        completed: sum.completed + c.completed,
        cancelled: sum.cancelled + c.cancelled,
        noShow: sum.noShow + c.noShow,
        receivedCents: sum.receivedCents + c.receivedCents,
      }),
      { created: 0, completed: 0, cancelled: 0, noShow: 0, receivedCents: 0 },
    );
  return { channels, assistant };
}
