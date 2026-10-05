import { requireModule } from "@/services/modules-guard";
import { z } from "zod";
import {
  conversationAction,
  conversationActionSchema,
  conversationDetail,
} from "@/services/assistant/workspace";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
const id = z.string().uuid();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireModule("recepcionista");
    return respond(await conversationDetail(id.parse((await params).id)));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireModule("recepcionista");
    assertSameOrigin(request);
    const input = conversationActionSchema.parse(await request.json());
    return respond(await conversationAction(id.parse((await params).id), input));
  } catch (error) {
    return failure(error);
  }
}
