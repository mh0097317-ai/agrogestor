import { z } from "zod";
import {
  emailOverview,
  emailSettingsSchema,
  previewKinds,
  resendKeySchema,
  saveEmailSettings,
  saveResendKey,
  sendTestEmail,
} from "@/services/email/platform-emails";
import {
  campaignAudience,
  campaignPreview,
  campaignSchema,
  draftCampaign,
  draftSchema,
  sendCampaign,
  sendCampaignSchema,
} from "@/services/email/campaign";
import { requirePlatformAdmin } from "@/services/platform";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  draftSchema.extend({ kind: z.literal("draft") }),
  campaignSchema.extend({ kind: z.literal("preview") }),
  z.object({ kind: z.literal("audience") }),
  sendCampaignSchema.extend({ kind: z.literal("send") }),
  resendKeySchema.extend({ kind: z.literal("resendKey") }),
  z.object({ kind: z.literal("resendKeyRemove") }),
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = action.parse(await request.json());
    if (input.kind === "test") return respond(await sendTestEmail(input.template));
    if (input.kind === "draft") return respond(await draftCampaign({ brief: input.brief }));
    if (input.kind === "audience") return respond(await campaignAudience());
    if (input.kind === "resendKey") return respond(await saveResendKey(input.key));
    if (input.kind === "resendKeyRemove") return respond(await saveResendKey(null));
    if (input.kind === "send") {
      const { kind: _k, ...rest } = input;
      void _k;
      return respond(await sendCampaign(rest));
    }
    if (input.kind === "preview") {
      await requirePlatformAdmin();
      const { kind: _k, ...rest } = input;
      void _k;
      return respond({ html: campaignPreview(rest) });
    }
    const { kind: _kind, ...settings } = input;
    void _kind;
    return respond(await saveEmailSettings(settings));
  } catch (error) {
    return failure(error);
  }
}
