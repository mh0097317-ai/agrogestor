import { platformReadiness } from "@/services/platform-readiness";
import { failure, respond } from "@/services/server-http";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return respond(await platformReadiness());
  } catch (e) {
    return failure(e);
  }
}
