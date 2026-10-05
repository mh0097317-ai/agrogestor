import {
  platformAction,
  platformActionSchema,
  platformOverview,
  platformPlan,
  platformPlanSchema,
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
/** Plano, mensalidade e módulos do estabelecimento. */
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    await platformPlan(platformPlanSchema.parse(await request.json()));
    return respond({ businesses: await platformOverview() });
  } catch (error) {
    return failure(error);
  }
}
