import { z } from "zod";
import {
  demoAgendaEnabled,
  demoAgendaSchema,
  setDemoAgenda,
} from "@/services/demo-agenda";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

/** Agenda de demonstração de um estabelecimento (só a equipe StudioFlow). */
export async function GET(request: Request) {
  try {
    const businessId = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("businessId"));
    return respond({ enabled: await demoAgendaEnabled(businessId) });
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    return respond(await setDemoAgenda(demoAgendaSchema.parse(await request.json())));
  } catch (error) {
    return failure(error);
  }
}
