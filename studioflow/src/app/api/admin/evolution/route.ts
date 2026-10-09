import { requirePlatformAdmin } from "@/services/platform";
import {
  evolutionConfigSchema,
  evolutionConfigView,
  saveEvolution,
} from "@/services/admin-vault";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requirePlatformAdmin();
    return respond(await evolutionConfigView());
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const { userId } = await requirePlatformAdmin();
    return respond(
      await saveEvolution(
        userId,
        evolutionConfigSchema.parse(await request.json()),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
