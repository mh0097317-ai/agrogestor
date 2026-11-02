import { leadAction, leadActionSchema, leadsView } from "@/services/leads/service";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
// Buscar lê o site de até 12 barbearias em paralelo.
export const maxDuration = 60;

/** Captação de barbearias (só a equipe StudioFlow). */
export async function GET() {
  try {
    return respond(await leadsView());
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return respond(await leadAction(leadActionSchema.parse(await request.json())));
  } catch (error) {
    return failure(error);
  }
}
