import { requirePlatformAdmin } from "@/services/platform";
import { DomainError } from "@/lib/availability";
import {
  elevenLabsSchema,
  elevenLabsView,
  removeElevenLabs,
  saveElevenLabs,
} from "@/services/assistant/speech";
import { assertSameOrigin, failure, respond } from "@/services/server-http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePlatformAdmin();
    return respond(await elevenLabsView());
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const { userId } = await requirePlatformAdmin();
    if (!userId) throw new DomainError("Configure no admin publicado.", 409);
    return respond(
      await saveElevenLabs(userId, elevenLabsSchema.parse(await request.json())),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { userId } = await requirePlatformAdmin();
    if (!userId) throw new DomainError("Configure no admin publicado.", 409);
    return respond(await removeElevenLabs(userId));
  } catch (error) {
    return failure(error);
  }
}
