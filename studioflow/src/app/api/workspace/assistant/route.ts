import { auditPanel } from "@/services/activity";
import { requireModule } from "@/services/modules-guard";
import { assistantSchema, updateAssistant } from "@/services/assistant/workspace";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    await requireModule("recepcionista");
    assertSameOrigin(request);
    const result = await updateAssistant(assistantSchema.parse(await request.json()));
    auditPanel("Alterou a recepcionista");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
