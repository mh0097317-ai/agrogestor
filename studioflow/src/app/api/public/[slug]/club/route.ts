import { subscribe, subscribeSchema } from "@/services/server-payments";
import {
  assertSameOrigin,
  failure,
  limitPublicMutation,
  respond,
} from "@/services/server-http";
export const dynamic = "force-dynamic";

/** Starts a club subscription; the first invoice opens on the provider. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertSameOrigin(request);
    limitPublicMutation(request);
    const input = subscribeSchema.parse(await request.json());
    return respond(await subscribe((await params).slug, input), 201);
  } catch (error) {
    return failure(error);
  }
}
