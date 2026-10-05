import { requireModule } from "@/services/modules-guard";
import { assistantSchema, updateAssistant } from "@/services/assistant/workspace";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    await requireModule("recepcionista");
    assertSameOrigin(request);
    return respond(await updateAssistant(assistantSchema.parse(await request.json())));
  } catch (error) {
    return failure(error);
  }
}
