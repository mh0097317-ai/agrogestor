import {
  connectInstagram,
  disconnectInstagram,
  instagramSchema,
} from "@/services/assistant/workspace";
import {
  assertSameOrigin,
  failure,
  requestOrigin,
  respond,
} from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = instagramSchema.parse(await request.json());
    return respond(await connectInstagram(input, requestOrigin(request)));
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    return respond(await disconnectInstagram());
  } catch (error) {
    return failure(error);
  }
}
