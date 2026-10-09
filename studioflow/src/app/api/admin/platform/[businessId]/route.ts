import { platformEvents, platformChannelEvents } from "@/services/platform";
import { failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const businessId = (await params).businessId;
    const events = await platformEvents(businessId);
    return respond({
      events,
      channelEvents: await platformChannelEvents(businessId),
    });
  } catch (error) {
    return failure(error);
  }
}
