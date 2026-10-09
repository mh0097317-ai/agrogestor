import { auditPanel } from "@/services/activity";
import { requireModule } from "@/services/modules-guard";
import {
  connectInstagram,
  disconnectInstagram,
  instagramSchema,
} from "@/services/assistant/workspace";
import {
  assertSameOrigin,
  failure,
  requestOrigin,
  respond,
} from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireModule("recepcionista");
    assertSameOrigin(request);
    const input = instagramSchema.parse(await request.json());
    const result = await connectInstagram(input, requestOrigin(request));
    auditPanel("Conectou o Instagram Direct");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const result = await disconnectInstagram();
    auditPanel("Desconectou o Instagram Direct");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
