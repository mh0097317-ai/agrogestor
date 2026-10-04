import {
  platformAction,
  platformActionSchema,
  platformOverview,
} from "@/services/platform";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return respond({ businesses: await platformOverview() });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await platformAction(platformActionSchema.parse(await request.json()));
    return respond({ businesses: await platformOverview() });
  } catch (error) {
    return failure(error);
  }
}
