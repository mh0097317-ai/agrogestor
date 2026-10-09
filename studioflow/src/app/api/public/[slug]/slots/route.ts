import { getOnlineBookingStore } from "@/services/server-online-booking";
import { availableSlots } from "@/lib/availability";
import { failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const query = new URL(request.url).searchParams;
    const store = await getOnlineBookingStore((await params).slug);
    return respond(
      availableSlots(
        store,
        (query.get("serviceId") || "").split(","),
        query.get("professionalId") || "any",
        query.get("date") || "",
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
