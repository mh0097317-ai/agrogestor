import { getOnlineBookingStore } from "@/services/server-online-booking";
import { joinWaitlist, waitlistJoinSchema } from "@/services/server-growth";
import {
  assertSameOrigin,
  failure,
  limitPublicMutation,
  respond,
} from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertSameOrigin(request);
    limitPublicMutation(request);
    await getOnlineBookingStore((await params).slug);
    const input = waitlistJoinSchema.parse(await request.json());
    return respond(await joinWaitlist((await params).slug, input), 201);
  } catch (error) {
    return failure(error);
  }
}
