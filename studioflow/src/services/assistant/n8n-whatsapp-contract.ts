import { createHash } from "node:crypto";
import { z } from "zod";

const turnInput = z
  .object({
    businessId: z.string().uuid(),
    professionalId: z.string().uuid().nullable(),
    conversationId: z.string().uuid(),
    channel: z.literal("whatsapp"),
    status: z.literal("ai"),
    messages: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            text: z.string().trim().min(1).max(4000),
            createdAt: z.iso.datetime({ offset: true }),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

/** Input must be loaded from the scoped conversation repository, never from
 * a customer request. This module prepares the contract only: it does not
 * forward messages, call models, reserve appointments or send WhatsApp. */
export function n8nWhatsAppTurn(input: z.input<typeof turnInput>) {
  const turn = turnInput.parse(input);
  if (
    new Set(turn.messages.map((message) => message.id)).size !==
    turn.messages.length
  )
    throw new Error("n8n-turn-duplicate-message");
  const sessionId = [
    "studioflow",
    turn.businessId,
    turn.professionalId || "business",
    turn.conversationId,
  ].join(":");
  const requestId = createHash("sha256")
    .update(JSON.stringify([sessionId, turn.messages]))
    .digest("hex");
  const text = turn.messages.map((message) => message.text).join("\n");
  if (Buffer.byteLength(text, "utf8") > 16000)
    throw new Error("n8n-turn-text-too-large");
  return {
    version: 1 as const,
    event: "STUDIOFLOW_WHATSAPP_TURN" as const,
    test: false as const,
    requestId,
    sessionId,
    context: {
      businessId: turn.businessId,
      professionalId: turn.professionalId,
      conversationId: turn.conversationId,
      channel: "whatsapp" as const,
      timezone: "America/Sao_Paulo" as const,
      bookingAllowed: false as const,
    },
    message: {
      text,
      // Stored message row IDs, not assumed Evolution/Meta provider IDs.
      ids: turn.messages.map((message) => message.id),
      createdAt: turn.messages.at(-1)!.createdAt,
    },
  };
}

export type N8nWhatsAppTurn = ReturnType<typeof n8nWhatsAppTurn>;

const responseSchema = z
  .object({
    version: z.literal(1),
    requestId: z.string().regex(/^[a-f0-9]{64}$/),
    sessionId: z.string().min(1).max(200),
    output: z.string().trim().min(1).max(4000),
    handoff: z.boolean(),
    bookingPerformed: z.literal(false),
  })
  .strict();

/** Correlation and shape checks only. Passing this check is not permission
 * to publish a reply: the dispatcher must recheck the lease, status and
 * message cursor, and validate the answer before calling the existing sender. */
export function n8nWhatsAppReply(raw: unknown, turn: N8nWhatsAppTurn) {
  const result = responseSchema.parse(raw);
  if (
    result.requestId !== turn.requestId ||
    result.sessionId !== turn.sessionId
  )
    throw new Error("n8n-turn-response-mismatch");
  if (Buffer.byteLength(result.output, "utf8") > 8000)
    throw new Error("n8n-turn-response-too-large");
  return result;
}
