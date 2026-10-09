import { auditPanel } from "@/services/activity";
import { requireModule } from "@/services/modules-guard";
import {
  changeMembership,
  membershipActionSchema,
} from "@/services/server-payments";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    await requireModule("clube");
    assertSameOrigin(request);
    const result = await changeMembership(
        membershipActionSchema.parse(await request.json()),
      );
    auditPanel("Alterou uma assinatura do clube");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
