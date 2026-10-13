import { platformAiControl } from "@/services/platform-ai-control";
import {
  assertSameOrigin,
  failure,
  respond,
  limitPublicMutation,
} from "@/services/server-http";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return respond(await platformAiControl());
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    limitPublicMutation(request, { scope: "platform-ai-control", max: 10 });
    return respond(await platformAiControl(await request.json()));
  } catch (e) {
    return failure(e);
  }
}
