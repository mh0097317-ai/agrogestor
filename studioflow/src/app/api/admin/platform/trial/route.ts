import { requirePlatformAdmin } from "@/services/platform";
import { setTrialDays, trialDays, trialSchema } from "@/services/platform-trial";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

/** Dias de teste grátis de quem se cadastra. */
export async function GET() {
  try {
    await requirePlatformAdmin();
    return respond({ days: await trialDays() });
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const { days } = trialSchema.parse(await request.json());
    await setTrialDays(days);
    return respond({ days });
  } catch (error) {
    return failure(error);
  }
}
