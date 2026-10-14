import { z } from "zod";
import {
  emailOverview,
  emailSettingsSchema,
  previewKinds,
  saveEmailSettings,
  sendTestEmail,
} from "@/services/email/platform-emails";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return respond(await emailOverview());
  } catch (error) {
    return failure(error);
  }
}

const action = z.discriminatedUnion("kind", [
  emailSettingsSchema.extend({ kind: z.literal("settings") }),
  z.object({ kind: z.literal("test"), template: z.enum(previewKinds) }),
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = action.parse(await request.json());
    if (input.kind === "test") return respond(await sendTestEmail(input.template));
    const { kind: _kind, ...settings } = input;
    void _kind;
    return respond(await saveEmailSettings(settings));
  } catch (error) {
    return failure(error);
  }
}
