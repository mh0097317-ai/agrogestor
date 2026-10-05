import { after } from "next/server";
import { z } from "zod";
import { receiveWhatsAppMessages } from "@/services/assistant/conversations";
import { parseEvolution, sendText } from "@/services/whatsapp/evolution";
import { linkForWebhook, saveLinkState } from "@/services/whatsapp/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requestOrigin } from "@/services/server-http";
export const dynamic = "force-dynamic";
// The answer runs after the 200 goes back to the WhatsApp server.
export const maxDuration = 60;

const id = z.string().uuid();
const plain = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain" } });

/** Messages and status of the business WhatsApp (QR Code connection). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const businessId = (await params).businessId;
  if (!id.safeParse(businessId).success) return plain("not found", 404);
  const link = await linkForWebhook(businessId, new URL(request.url).searchParams.get("token"));
  if (!link) return plain("forbidden", 403);
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return plain("ok");
  }
  const delivery = parseEvolution(body);
  if (delivery.instance && delivery.instance !== link.instance) return plain("ok");
  try {
    if (delivery.state) await saveLinkState(businessId, delivery.state);
    if (!delivery.messages.length) return plain("ok");
    const { data: business } = await createSupabaseAdmin()
      .from("businesses")
      .select("tenant_id")
      .eq("id", businessId)
      .single();
    const work = await receiveWhatsAppMessages({
      businessId,
      tenantId: business!.tenant_id,
      origin: requestOrigin(request),
      messages: delivery.messages.map((message) => ({
        id: message.id,
        from: message.from,
        name: message.name,
        text: message.text,
        loadAudio: message.audio
          ? async () => {
              const bytes = Buffer.from(message.audio!.base64, "base64");
              return {
                audio: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
                mime: message.audio!.mime,
              };
            }
          : undefined,
      })),
      send: (to, text) => sendText(link.instance, to, text),
    });
    after(work);
  } catch (error) {
    console.error(
      "StudioFlow Evolution error:",
      error instanceof Error ? error.message : "unknown",
    );
    return plain("retry", 503);
  }
  return plain("ok");
}
