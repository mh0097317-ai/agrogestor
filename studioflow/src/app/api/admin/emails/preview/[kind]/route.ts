import { z } from "zod";
import { requirePlatformAdmin } from "@/services/platform";
import { previewKinds, sampleEmail } from "@/services/email/platform-emails";
import { failure } from "@/services/server-http";
export const dynamic = "force-dynamic";

/** Prévia do e-mail com dados de exemplo, aberta num quadro do /admin. */
export async function GET(_request: Request, context: { params: Promise<{ kind: string }> }) {
  try {
    await requirePlatformAdmin();
    const kind = z.enum(previewKinds).parse((await context.params).kind);
    return new Response(sampleEmail(kind).html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
