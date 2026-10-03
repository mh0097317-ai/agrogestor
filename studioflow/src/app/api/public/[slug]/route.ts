import { getPublicStore, publicProfessional } from "@/services/server-store";
import { failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const store = await getPublicStore((await params).slug);
    return respond({
      business: store.business,
      services: store.services.filter((service) => service.active),
      professionals: store.professionals
        .filter((person) => person.active)
        .map(publicProfessional),
      settings: store.settings,
    });
  } catch (error) {
    return failure(error);
  }
}
