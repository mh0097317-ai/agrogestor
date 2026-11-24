import type { Appointment, PaymentMethod, Store } from "@/types";
import { balanceFor, reais } from "@/features/management/finance-helpers";

export const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "credit", label: "Crédito" },
  { value: "debit", label: "Débito" },
];

type Mutate = (
  collection: "appointments" | "payments",
  action: "update" | "create",
  payload: Record<string, unknown>,
) => Promise<unknown>;

/** Quanto falta receber deste atendimento (já descontado sinal e pagamentos). */
export function amountDue(appointment: Appointment, data: Store) {
  return reais(balanceFor(appointment, data));
}

/**
 * Conclui o atendimento e, se veio a forma de pagamento, registra o que
 * faltava receber. Usado pelo Salão ao vivo e pelo detalhe da agenda.
 */
export async function finishAppointment(
  mutate: Mutate,
  data: Store,
  appointment: Appointment,
  method?: PaymentMethod,
) {
  const due = amountDue(appointment, data);
  await mutate("appointments", "update", {
    id: appointment.id,
    status: "completed",
  });
  if (method && due > 0)
    await mutate("payments", "create", {
      id: crypto.randomUUID(),
      businessId: data.business.id,
      appointmentId: appointment.id,
      amount: due,
      method,
    });
  return method && due > 0 ? due : 0;
}
