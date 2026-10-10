import {
  publishMarketingNow,
  updateMarketingPost,
  updateSchema,
} from "@/services/marketing/service";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    return respond(await updateMarketingPost(id, updateSchema.parse(await request.json())));
  } catch (error) {
    return failure(error);
  }
}

/** Publica agora no Instagram. */
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    return respond(await publishMarketingNow(id));
  } catch (error) {
    return failure(error);
  }
}
