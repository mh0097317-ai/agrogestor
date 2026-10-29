import { after } from "next/server";
import { z } from "zod";
import { receiveWhatsAppMessages } from "@/services/assistant/conversations";
import {
  parseEvolution,
  sendText,
  sendBookingMenu,
  sendWhatsAppAudio,
  evolutionAudio,
  evolutionImage,
  parseEvolutionChanges,
} from "@/services/whatsapp/evolution";
import {
  duplicatesShopLink,
  linkForWebhook,
  saveLinkState,
} from "@/services/whatsapp/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requestOrigin } from "@/services/server-http";
export const dynamic = "force-dynamic";
// The answer runs after the 200 goes back to the WhatsApp server.
export const maxDuration = 120;

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
  const professionalId =
    new URL(request.url).searchParams.get("professionalId") || undefined;
  if (professionalId && !id.safeParse(professionalId).success)
    return plain("not found", 404);
  // Existing instances keep working; new connections put the secret in a header.
  const link = await linkForWebhook(
    businessId,
    request.headers.get("x-studioflow-webhook-token") ||
      new URL(request.url).searchParams.get("token"),
    professionalId,
  );
  if (!link) return plain("forbidden", 403);
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return plain("ok");
  }
  const delivery = parseEvolution(body, true);
  if (delivery.instance !== link.instance) return plain("forbidden", 403);
  try {
    if (delivery.state)
      await saveLinkState(businessId, delivery.state, professionalId);
    // Same number as the shop link: the shop link already got this message.
    if (await duplicatesShopLink(businessId, professionalId)) return plain("ok");
    const changes = parseEvolutionChanges(body);
    if (changes.messages.length || changes.phones.length) {
      const admin = createSupabaseAdmin();
      let conversations = admin
        .from("conversations")
        .select("id")
        .eq("business_id", businessId)
        .eq("channel", "whatsapp");
      conversations = professionalId
        ? conversations.eq("whatsapp_professional_id", professionalId)
        : conversations.is("whatsapp_professional_id", null);
      if (changes.phones.length)
        conversations = conversations.in("contact_phone", changes.phones);
      const { data: scope, error: scopeError } = await conversations;
      if (scopeError) throw new Error("whatsapp-delete-scope-failed");
      if (scope?.length) {
        let remove = admin
          .from("conversation_messages")
          .delete()
          .eq("business_id", businessId)
          .in(
            "conversation_id",
            scope.map((row) => row.id),
          )
          .neq("role", "event");
        if (changes.messages.length)
          remove = remove.in(
            "provider_message_id",
            changes.messages.map((id) =>
              professionalId ? `${professionalId}:${id}` : id,
            ),
          );
        const { error } = await remove;
        if (error) throw new Error("whatsapp-delete-failed");
      }
    }
    if (!delivery.messages.length) return plain("ok");
    const { data: business } = await createSupabaseAdmin()
      .from("businesses")
      .select("tenant_id")
      .eq("id", businessId)
      .single();
    const work = await receiveWhatsAppMessages({
      businessId,
      tenantId: business!.tenant_id,
      professionalId,
      origin: requestOrigin(request),
      messages: delivery.messages
        .filter((message) => !message.fromMe)
        .map((message) => ({
          id: message.id,
          from: message.from,
          name: message.name,
          text: message.text,
          fromMe: message.fromMe,
          createdAt: message.createdAt,
          loadAudio: message.audioId
            ? () =>
                evolutionAudio(
                  link.instance,
                  message.audioId!,
                  message.audio?.base64,
                  message.audio?.mime,
                )
            : undefined,
          loadImage: message.imageId
            ? () =>
                evolutionImage(
                  link.instance,
                  message.imageId!,
                  message.image?.base64,
                  message.image?.mime,
                )
            : undefined,
        })),
      send: async (to, text, menu, audio) => {
        const result = await (menu
          ? sendBookingMenu(link.instance, to, text, menu)
          : sendText(link.instance, to, text, "assistant"));
        if (audio) {
          try {
            await sendWhatsAppAudio(link.instance, to, audio);
          } catch (error) {
            console.error("StudioFlow voice reply error:", {
              code:
                error instanceof Error && error.message.startsWith("elevenlabs-speech-")
                  ? error.message
                  : "whatsapp-audio-send-failed",
            });
          }
        }
        return result;
      },
    });
    after(work);
    const outgoing = delivery.messages.filter((message) => message.fromMe);
    if (outgoing.length)
      after(async () => {
        // Give the sending request time to persist its provider ID. Its echo is
        // then deduplicated instead of being mistaken for a manual team reply.
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await receiveWhatsAppMessages({
          businessId,
          tenantId: business!.tenant_id,
          professionalId,
          origin: requestOrigin(request),
          messages: outgoing,
          send: (to, text) => sendText(link.instance, to, text),
        });
      });
  } catch (error) {
    console.error(
      "StudioFlow Evolution error:",
      error instanceof Error ? error.message : "unknown",
    );
    return plain("retry", 503);
  }
  return plain("ok");
}
