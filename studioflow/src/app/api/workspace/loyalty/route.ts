import { auditPanel } from "@/services/activity";
import { requireModule } from "@/services/modules-guard";
import { loyaltySchema, updateLoyalty } from "@/services/server-growth";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request) {
  try {
    await requireModule("fidelidade");
    assertSameOrigin(request);
    const result = await updateLoyalty(loyaltySchema.parse(await request.json()));
    auditPanel("Alterou o cartão fidelidade");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
