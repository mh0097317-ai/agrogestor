import { z } from "zod";
import {
  adminSubscriptionRequests,
  resolveSubscriptionRequest,
} from "@/services/platform-plans";
import { assertSameOrigin, failure, respond } from "@/services/server-http";

export const dynamic = "force-dynamic";
const resolveSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["done", "rejected"]),
  note: z.string().trim().max(500).optional(),
});
export async function GET() {
  try {
    return respond(await adminSubscriptionRequests());
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await resolveSubscriptionRequest(resolveSchema.parse(await request.json()));
    return respond(await adminSubscriptionRequests());
  } catch (e) {
    return failure(e);
  }
}
