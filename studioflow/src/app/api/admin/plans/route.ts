import { adminPlans, savePlan } from "@/services/platform-plans";
import { assertSameOrigin, failure, respond } from "@/services/server-http";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return respond(await adminPlans());
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    await savePlan(await request.json());
    return respond(await adminPlans());
  } catch (e) {
    return failure(e);
  }
}
