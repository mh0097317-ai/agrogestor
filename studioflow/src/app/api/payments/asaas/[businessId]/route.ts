import { DomainError } from "@/lib/availability";
import { handleAsaasWebhook } from "@/services/server-payments";
import { respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

/**
 * Asaas payment notifications for one business. The token configured at
 * connection travels in `asaas-access-token`. Returns 200 once handled (or
 * deliberately ignored) and 5xx on a transient failure so Asaas retries.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const body = await request.json().catch(() => null);
    return respond(
      await handleAsaasWebhook(
        (await params).businessId,
        request.headers.get("asaas-access-token"),
        body,
      ),
    );
  } catch (error) {
    if (error instanceof DomainError)
      return respond({ error: error.message }, error.status);
    console.error(
      "StudioFlow webhook error:",
      error instanceof Error ? error.message : "unknown",
    );
    return respond({ error: "retry" }, 503);
  }
}
