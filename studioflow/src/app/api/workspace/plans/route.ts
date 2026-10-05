import { requireModule } from "@/services/modules-guard";
import { z } from "zod";
import { planSchema, savePlan, setPlanActive } from "@/services/server-payments";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
const activeSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

export async function POST(request: Request) {
  try {
    await requireModule("clube");
    assertSameOrigin(request);
    return respond(await savePlan(planSchema.parse(await request.json())));
  } catch (error) {
    return failure(error);
  }
}
/** Archive or reopen a plan. */
export async function PATCH(request: Request) {
  try {
    await requireModule("clube");
    assertSameOrigin(request);
    const input = activeSchema.parse(await request.json());
    return respond(await setPlanActive(input.id, input.active));
  } catch (error) {
    return failure(error);
  }
}
