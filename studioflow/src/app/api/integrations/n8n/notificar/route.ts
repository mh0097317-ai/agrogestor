import { n8nIntegration } from "@/services/assistant/n8n-consultation";
import {
  notificationSchema,
  notifyN8nCustomer,
} from "@/services/assistant/n8n-notifications";
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
    limitPublicMutation(request, {
      scope: `n8n-retention:${integration.businessId}:${integration.professionalId}`,
      max: 1000,
    });
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 2048)
      throw new DomainError("Requisição muito grande.", 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new DomainError("JSON inválido.", 400);
    }
    return respond(
      await notifyN8nCustomer(notificationSchema.parse(body), integration),
    );
  } catch (error) {
    return failure(error);
  }
}
