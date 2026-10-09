import { n8nIntegration } from "@/services/assistant/n8n-consultation";
import {
  notificationAction,
  notificationCandidates,
} from "@/services/assistant/n8n-notifications";
import { failure, limitPublicMutation, respond } from "@/services/server-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const integration = n8nIntegration(
      request.headers.get("x-studioflow-integration-token"),
      process.env.N8N_INTEGRATIONS,
    );
    limitPublicMutation(request, {
      scope: `n8n-retention:${integration.businessId}:${integration.professionalId}`,
      max: 1000,
    });
    const action = notificationAction.parse(
      new URL(request.url).searchParams.get("action"),
    );
    return respond(await notificationCandidates(action, integration));
  } catch (error) {
    return failure(error);
  }
}
