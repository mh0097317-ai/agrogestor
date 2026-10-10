import { operationSnapshot } from "@/services/operation-health";
import { failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return respond(await operationSnapshot()); }
  catch (error) { return failure(error); }
}
