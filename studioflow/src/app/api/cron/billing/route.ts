import { timingSafeEqual } from "node:crypto";
import { sendBillingReminders } from "@/services/billing-reminders";
import { refreshInstagramTokens } from "@/services/instagram-feed";
import { requestOrigin } from "@/services/server-http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron, uma vez por dia (vercel.json). Só com o CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const header = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (!secret || header.length !== expected.length || !timingSafeEqual(Buffer.from(header), Buffer.from(expected)))
    return new Response("forbidden", { status: 401 });
  try {
    const [billing, instagram] = await Promise.all([
      sendBillingReminders(requestOrigin(request)),
      // Same daily run: keeps the Instagram tokens (60 days) alive.
      refreshInstagramTokens(),
    ]);
    return Response.json({ billing, instagram });
  } catch {
    return new Response("retry", { status: 503 });
  }
}
