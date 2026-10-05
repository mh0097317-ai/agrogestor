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
    return respond(await connectWhatsApp(input, requestOrigin(request)));
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    return respond(await disconnectWhatsApp());
  } catch (error) {
    return failure(error);
  }
}
