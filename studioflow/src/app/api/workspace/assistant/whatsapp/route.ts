import { auditPanel } from "@/services/activity";
import { requireModule } from "@/services/modules-guard";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  whatsappSchema,
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
    const input = whatsappSchema.parse(await request.json());
    const result = await connectWhatsApp(input, requestOrigin(request));
    auditPanel("Conectou o WhatsApp oficial");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const result = await disconnectWhatsApp();
    auditPanel("Desconectou o WhatsApp oficial");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
