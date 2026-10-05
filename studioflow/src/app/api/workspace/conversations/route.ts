import { requireModule } from "@/services/modules-guard";
import { listConversations } from "@/services/assistant/workspace";
import { failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireModule("recepcionista");
    return respond(await listConversations());
  } catch (error) {
    return failure(error);
  }
}
