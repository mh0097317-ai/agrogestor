import { hasModule } from "@/lib/modules";
import { ratingSummary } from "@/lib/reviews";
import type { PublicCatalog } from "@/features/public/types";
import { publicProducts } from "./server-products";
import { getPublicStore, publicProfessional } from "./server-store";
import { getPaymentAccount, publicPlans } from "./server-payments";
import { isDemo } from "./server-demo";

/** Most booked active service in the last 90 days, from real bookings. */
function popularService(store: Awaited<ReturnType<typeof getPublicStore>>) {
  const since = Date.now() - 90 * 86_400_000;
  const counts = new Map<string, number>();
  for (const item of store.appointments)
    if (
      !["cancelled", "no_show"].includes(item.status) &&
      new Date(item.start).getTime() >= since
    )
      for (const id of item.serviceIds)
        counts.set(id, (counts.get(id) || 0) + 1);
  const [top, second] = [...counts.entries()]
    .filter(([id]) => store.services.some((s) => s.id === id && s.active))
    .sort((a, b) => b[1] - a[1]);
  // Only a clear favorite: at least 3 bookings and ahead of the next one.
  return top && top[1] >= 3 && (!second || top[1] > second[1]) ? top[0] : null;
}
/**
 * What the public page and the booking show. Only averages and public
 * fields leave the server: no names, comments, costs or payment keys.
 */
export async function publicCatalog(slug: string): Promise<PublicCatalog> {
  const store = await getPublicStore(slug);
  const payments = isDemo()
    ? !!store.paymentAccount
    : !!(await getPaymentAccount(store.business.id));
  const catalog = {
    business: store.business,
    services: store.services.filter((service) => service.active),
    professionals: store.professionals
      .filter((person) => person.active)
      .map((person) => ({
        ...publicProfessional(person),
        rating: ratingSummary(store.reviews, person.id),
      })),
    // Internal assistant notes and limits stay with the owner.
    settings: {
      ...store.settings,
      assistantInstructions: undefined,
      assistantDailyLimit: undefined,
    },
    rating: ratingSummary(store.reviews),
    onlinePayments: payments,
    plans: payments ? publicPlans(store) : [],
    popularServiceId: popularService(store),
    // Só nome, foto, descrição e preço: sem custo nem estoque.
    products: publicProducts(store),
    // Partes da página que dependem do plano do estabelecimento.
    features: {
      waitlist: hasModule(store.access?.modules, "espera"),
      checkin: hasModule(store.access?.modules, "recepcao"),
    },
  };
  // The same JSON the client reads from /api/public/[slug].
  return JSON.parse(JSON.stringify(catalog)) as PublicCatalog;
}
