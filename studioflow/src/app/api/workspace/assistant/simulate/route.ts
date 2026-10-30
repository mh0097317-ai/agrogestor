import { requireModule } from "@/services/modules-guard";
import {
  simulateAssistant,
  simulateSchema,
} from "@/services/assistant/workspace";
import {
  assertSameOrigin,
  failure,
  requestOrigin,
  respond,
} from "@/services/server-http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The receptionist's test chat: answers like WhatsApp, sends and books nothing. */
export async function POST(request: Request) {
  try {
    await requireModule("recepcionista");
    assertSameOrigin(request);
    return respond(
      await simulateAssistant(
        simulateSchema.parse(await request.json()),
        requestOrigin(request),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
