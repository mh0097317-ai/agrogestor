import { platformEvents } from "@/services/platform";
import { failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    return respond({ events: await platformEvents((await params).businessId) });
  } catch (error) {
    return failure(error);
  }
}
