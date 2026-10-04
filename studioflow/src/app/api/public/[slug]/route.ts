import { getPublicStore, publicProfessional } from "@/services/server-store";
import { failure, respond } from "@/services/server-http";
import { ratingSummary } from "@/lib/reviews";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const store = await getPublicStore((await params).slug);
    // Only averages leave the server: no names or comments.
    return respond({
      business: store.business,
      services: store.services.filter((service) => service.active),
      professionals: store.professionals
        .filter((person) => person.active)
        .map((person) => ({
          ...publicProfessional(person),
          rating: ratingSummary(store.reviews, person.id),
        })),
      settings: store.settings,
      rating: ratingSummary(store.reviews),
    });
  } catch (error) {
    return failure(error);
  }
}
