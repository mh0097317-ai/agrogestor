import {
  n8nConsultation,
  n8nConsultationSchema,
  n8nIntegration,
} from "@/services/assistant/n8n-consultation";
import { getPublicStore } from "@/services/server-store";
import { failure, limitPublicMutation, respond } from "@/services/server-http";
import { DomainError } from "@/lib/availability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const integration = n8nIntegration(
      request.headers.get("x-studioflow-integration-token"),
      process.env.N8N_INTEGRATIONS,
    );
    limitPublicMutation(request);
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 4096)
      throw new DomainError("Requisição muito grande.", 413);
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new DomainError("JSON inválido.", 400);
    }
    return respond(
      await n8nConsultation(
        n8nConsultationSchema.parse(json),
        integration,
        () => getPublicStore(integration.slug),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
