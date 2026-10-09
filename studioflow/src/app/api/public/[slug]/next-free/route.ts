import { getOnlineBookingStore } from "@/services/server-online-booking";
import { nextFreeByProfessional } from "@/lib/availability";
import { failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
/** Public projection: only professional id and the earliest free slot. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const query = new URL(request.url).searchParams;
    const store = await getOnlineBookingStore((await params).slug);
    return respond(
      nextFreeByProfessional(store, (query.get("serviceId") || "").split(",")),
    );
  } catch (error) {
    return failure(error);
  }
}
