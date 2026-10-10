import type { Store } from "@/types";
import { commercialImpact } from "./commercial-impact";

/** Three independent facts in the period, not predicted revenue or a conversion rate. */
export function assistantImpact(data: Store, from: string, to: string) {
  const { assistant } = commercialImpact(
    {
      businessId: data.business.id,
      appointments: data.appointments,
      payments: data.payments,
    },
    from,
    to,
  );
  return {
    created: assistant.created,
    completed: assistant.completed,
    received: assistant.receivedCents / 100,
  };
}
