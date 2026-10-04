import { checkIn, checkInSchema } from "@/services/server-checkin";
import {
  assertSameOrigin,
  failure,
  limitPublicMutation,
  respond,
} from "@/services/server-http";
export const dynamic = "force-dynamic";

/** O cliente avisa que chegou: pelo link do comprovante ou pelo WhatsApp. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertSameOrigin(request);
    limitPublicMutation(request);
    const input = checkInSchema.parse(await request.json());
    return respond(await checkIn((await params).slug, input));
  } catch (error) {
    return failure(error);
  }
}
