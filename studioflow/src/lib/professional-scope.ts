import { DomainError } from "./availability";
import type { Store } from "@/types";

export function assertProfessionalChannel(
  member: { role: string; professionalId?: string },
  requested?: string | null,
) {
  if (
    member.role === "professional" &&
    (!member.professionalId || requested !== member.professionalId)
  )
    throw new DomainError("Você pode acessar apenas o seu WhatsApp.", 403);
}

/** UI projection complements RLS; never apply this to the public booking catalog. */
export function professionalWorkspace(store: Store, id: string): Store {
  const appointments = store.appointments.filter(
    (a) => a.professionalId === id,
  );
  const appointmentIds = new Set(appointments.map((a) => a.id));
  const customerIds = new Set(appointments.map((a) => a.customerId));
  return {
    ...store,
    professionals: store.professionals.filter((p) => p.id === id),
    services: store.services
      .filter((s) => s.professionalIds.includes(id))
      .map((s) => ({ ...s, professionalIds: [id] })),
    appointments,
    customers: store.customers.filter((c) => customerIds.has(c.id)),
    blockedTimes: store.blockedTimes.filter((b) => b.professionalId === id),
    payments: store.payments.filter((p) => appointmentIds.has(p.appointmentId)),
    reviews: store.reviews?.filter((r) => r.professionalId === id),
    waitlist: store.waitlist?.filter((w) => w.professionalId === id),
    memberships: [],
    products: [],
    productSales: [],
    paymentAccount: null,
    whatsapp: null,
    whatsappLink: null,
    instagram: null,
    instagramFeed: null,
    professionalWhatsAppLinks: store.professionalWhatsAppLinks?.filter(
      (l) => l.professionalId === id,
    ),
  };
}
