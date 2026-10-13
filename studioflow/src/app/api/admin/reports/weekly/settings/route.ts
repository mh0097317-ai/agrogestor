import { platformWeeklyPreferences } from "@/services/platform-weekly-delivery";
import {
  assertSameOrigin,
  failure,
  respond,
  limitPublicMutation,
} from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return respond(await platformWeeklyPreferences());
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    limitPublicMutation(request, {
      scope: "platform-weekly-settings",
      max: 10,
    });
    return respond(await platformWeeklyPreferences(await request.json()));
  } catch (e) {
    return failure(e);
  }
}
