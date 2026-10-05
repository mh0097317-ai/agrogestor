import {
  connectInstagramFeed,
  disconnectInstagramFeed,
  instagramFeedSchema,
} from "@/services/instagram-feed";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = instagramFeedSchema.parse(await request.json());
    return respond(await connectInstagramFeed(input));
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    return respond(await disconnectInstagramFeed());
  } catch (error) {
    return failure(error);
  }
}
