import { getOnlineBookingStore } from "@/services/server-online-booking";
import { z } from "zod";
import { webChat, webChatView } from "@/services/assistant/conversations";
import { tokenSchema } from "@/services/server-validation";
import {
  assertSameOrigin,
  failure,
  limitPublicMutation,
  requestOrigin,
  respond,
} from "@/services/server-http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const messageSchema = z.object({
  token: tokenSchema.optional(),
  message: z.string().trim().min(1, "Escreva uma mensagem.").max(1000),
});

/** Customer message to the AI receptionist (web chat on the public page). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertSameOrigin(request);
    limitPublicMutation(request);
    await getOnlineBookingStore((await params).slug);
    const input = messageSchema.parse(await request.json());
    return respond(
      await webChat((await params).slug, input, requestOrigin(request)),
    );
  } catch (error) {
    return failure(error);
  }
}

/** New messages for the open chat (the team may answer). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const token = tokenSchema.parse(
      new URL(request.url).searchParams.get("token"),
    );
    return respond(await webChatView((await params).slug, token));
  } catch (error) {
    return failure(error);
  }
}
