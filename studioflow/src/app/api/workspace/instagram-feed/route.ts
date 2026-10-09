import { auditPanel } from "@/services/activity";
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
    const result = await connectInstagramFeed(input);
    auditPanel("Ligou os posts do Instagram na página");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const result = await disconnectInstagramFeed();
    auditPanel("Tirou os posts do Instagram da página");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
