import { z } from "zod";
import { requirePlatformAdmin } from "@/services/platform";
import {
  adminClientConfig,
  saveAdminAssistant,
  manualInvoiceSchema,
  updateManualInvoice,
} from "@/services/admin-client-config";
import { aiKeySchema, saveAiKey, changeAiModel } from "@/services/admin-vault";
import { assistantSchema } from "@/services/assistant/workspace";
import { audioKeySchema, saveAudioKey } from "@/services/assistant/audio-vault";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ businessId: string }> };
async function business(context: Context) {
  return z.uuid().parse((await context.params).businessId);
}
export async function GET(_request: Request, context: Context) {
  try {
    return respond(await adminClientConfig(await business(context)));
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { userId } = await requirePlatformAdmin();
    const id = await business(context);
    const input = z
      .discriminatedUnion("kind", [
        aiKeySchema.extend({ kind: z.literal("key") }),
        assistantSchema.extend({ kind: z.literal("assistant") }),
        z.object({ kind: z.literal("removeKey") }),
        z.object({ kind: z.literal("model"), model: aiKeySchema.shape.model }),
        audioKeySchema.extend({ kind: z.literal("audioKey") }),
      ])
      .parse(await request.json());
    if (input.kind === "assistant") await saveAdminAssistant(id, input);
    else if (input.kind === "model")
      await changeAiModel(id, userId, input.model);
    else if (input.kind === "audioKey") await saveAudioKey(id, userId!, input);
    else await saveAiKey(id, userId, input.kind === "key" ? input : null);
    return respond(await adminClientConfig(id));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    await requirePlatformAdmin();
    const id = await business(context);
    await updateManualInvoice(
      id,
      manualInvoiceSchema.parse(await request.json()),
    );
    return respond(await adminClientConfig(id));
  } catch (error) {
    return failure(error);
  }
}
