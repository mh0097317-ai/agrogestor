import { requireModule } from "@/services/modules-guard";
import { z } from "zod";
import { after } from "next/server";
import {
  conversationAction,
  conversationActionSchema,
  conversationDetail,
} from "@/services/assistant/workspace";
import {
  assertSameOrigin,
  failure,
  respond,
  requestOrigin,
} from "@/services/server-http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
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
    const result = await conversationAction(
      id.parse((await params).id),
      input,
      requestOrigin(request),
    );
    if ("work" in result && result.work) after(result.work);
    return respond({
      ok: result.ok,
      ...("notice" in result ? { notice: result.notice } : {}),
    });
  } catch (error) {
    return failure(error);
  }
}
