import { z } from "zod";
import { logPageEvent, pageEventKinds } from "@/services/activity";
import { businessIdForSlug } from "@/services/server-store";
import { allowRate, assertSameOrigin } from "@/services/server-http";
export const dynamic = "force-dynamic";

const schema = z.object({
  visitor: z.string().regex(/^[a-z0-9]{16,40}$/),
  kind: z.enum(pageEventKinds),
  detail: z.string().max(60).default(""),
  ref: z
    .string()
    .max(80)
    .regex(/^[a-z0-9.-]*$/i)
    .default(""),
});

function device(agent: string) {
  if (/ipad|tablet/i.test(agent)) return "tablet" as const;
  if (/mobi|android|iphone/i.test(agent)) return "celular" as const;
  return agent ? ("computador" as const) : ("" as const);
}

/** Visitas e cliques da página. Sempre 204: a métrica nunca dá erro ao cliente. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertSameOrigin(request);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    if (!allowRate(`track:${ip}`, 90)) return new Response(null, { status: 204 });
    const input = schema.parse(JSON.parse(await request.text()));
    const businessId = await businessIdForSlug((await params).slug);
    if (businessId)
      await logPageEvent(businessId, {
        visitor: input.visitor,
        kind: input.kind,
        detail: input.detail,
        device: device(request.headers.get("user-agent") || ""),
        referrer: input.ref.toLowerCase(),
      });
  } catch {
    // Ignored on purpose.
  }
  return new Response(null, { status: 204 });
}
