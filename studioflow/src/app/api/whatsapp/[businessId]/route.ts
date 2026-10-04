import { after } from "next/server";
import { z } from "zod";
import { matchesHash } from "@/services/server-secrets";
import {
  receiveWhatsApp,
  whatsappAccount,
} from "@/services/assistant/conversations";
import {
  inboundMessages,
  validSignature,
} from "@/services/assistant/whatsapp";
import { requestOrigin } from "@/services/server-http";
export const dynamic = "force-dynamic";
// The answer runs after the 200 goes back to Meta.
export const maxDuration = 60;

const id = z.string().uuid();
const plain = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain" } });

/** Meta's webhook check: echo the challenge when the verify token matches. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const businessId = (await params).businessId;
  if (!id.safeParse(businessId).success) return plain("not found", 404);
  const query = new URL(request.url).searchParams;
  const account = await whatsappAccount(businessId).catch(() => null);
  if (
    !account ||
    query.get("hub.mode") !== "subscribe" ||
    !matchesHash(query.get("hub.verify_token"), account.verifyTokenHash)
  )
    return plain("forbidden", 403);
  return plain(query.get("hub.challenge") || "");
}

/** Messages from customers. Signed by Meta with the app secret. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const businessId = (await params).businessId;
  if (!id.safeParse(businessId).success) return plain("not found", 404);
  const raw = await request.text();
  const account = await whatsappAccount(businessId).catch(() => null);
  if (!account) return plain("not found", 404);
  if (
    !validSignature(raw, request.headers.get("x-hub-signature-256"), account.appSecret)
  )
    return plain("forbidden", 401);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return plain("ok");
  }
  const messages = inboundMessages(body);
  if (!messages.length) return plain("ok");
  try {
    const work = await receiveWhatsApp(account, messages, requestOrigin(request));
    after(work);
  } catch (error) {
    console.error(
      "StudioFlow WhatsApp error:",
      error instanceof Error ? error.message : "unknown",
    );
    // Meta retries on non-200; messages already stored are skipped.
    return plain("retry", 503);
  }
  return plain("ok");
}
