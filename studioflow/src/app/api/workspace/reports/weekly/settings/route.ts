import { weeklyPreferences } from "@/services/weekly-report-delivery";
import {
  assertSameOrigin,
  failure,
  respond,
  limitPublicMutation,
} from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return respond(await weeklyPreferences());
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    limitPublicMutation(request, { scope: "weekly-report-settings", max: 10 });
    return respond(await weeklyPreferences(await request.json()));
  } catch (e) {
    return failure(e);
  }
}
