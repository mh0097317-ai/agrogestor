import { auditPanel } from "@/services/activity";
import { z } from "zod";
import {
  notifySchema,
  pollWhatsAppLink,
  simulateDemoScan,
  startWhatsAppLink,
  unlinkWhatsApp,
  updateNotify,
} from "@/services/whatsapp/link";
import {
  assertSameOrigin,
  failure,
  requestOrigin,
  respond,
} from "@/services/server-http";
export const dynamic = "force-dynamic";

/** Status of the QR Code connection (the panel asks every few seconds). */
function professional(request: Request) {
  const value = new URL(request.url).searchParams.get("professionalId");
  return value ? z.string().uuid().parse(value) : undefined;
}
export async function GET(request: Request) {
  try {
    return respond(await pollWhatsAppLink(professional(request)));
  } catch (error) {
    return failure(error);
  }
}
/** Starts the connection and returns the QR Code to scan. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json().catch(() => ({}));
    if (z.object({ simulate: z.literal(true) }).safeParse(body).success)
      return respond(await simulateDemoScan());
    const result = await startWhatsAppLink(requestOrigin(request), professional(request));
    auditPanel("Gerou o QR Code do WhatsApp");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
/** Automatic messages on or off. */
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const result = await updateNotify(notifySchema.parse(await request.json()));
    auditPanel("Mudou os avisos automáticos do WhatsApp");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const result = await unlinkWhatsApp(professional(request));
    auditPanel("Desconectou o WhatsApp");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
