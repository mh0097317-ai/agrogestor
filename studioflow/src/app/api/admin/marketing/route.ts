import { z } from "zod";
import { settingsSchema } from "@/services/marketing/content";
import {
  connectMarketingAccount,
  connectSchema,
  createReel,
  createReelSchema,
  disconnectMarketingAccount,
  generateMarketingPosts,
  generateSchema,
  aiKeySchema,
  marketingState,
  modelSchema,
  reelFromPost,
  saveMarketingAiKey,
  saveMarketingSettings,
  setMarketingModel,
  setMarketingPower,
  suggestMarketing,
  suggestSchema,
  videoUploadUrl,
} from "@/services/marketing/service";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  try {
    return respond(await marketingState());
  } catch (error) {
    return failure(error);
  }
}

const action = z.discriminatedUnion("kind", [
  connectSchema.extend({ kind: z.literal("connect") }),
  z.object({ kind: z.literal("disconnect") }),
  settingsSchema.extend({ kind: z.literal("settings") }),
  generateSchema.extend({ kind: z.literal("generate") }),
  createReelSchema.extend({ kind: z.literal("reel") }),
  z.object({ kind: z.literal("uploadUrl"), fileName: z.string().max(200) }),
  z.object({ kind: z.literal("power"), enabled: z.boolean() }),
  aiKeySchema.extend({ kind: z.literal("aiKey") }),
  z.object({ kind: z.literal("aiKeyRemove") }),
  modelSchema.extend({ kind: z.literal("model") }),
  z.object({ kind: z.literal("toReel"), id: z.string().uuid() }),
  suggestSchema.extend({ kind: z.literal("suggest") }),
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = action.parse(await request.json());
    switch (input.kind) {
      case "connect":
        return respond(await connectMarketingAccount(input.token));
      case "disconnect":
        return respond(await disconnectMarketingAccount());
      case "settings":
        return respond(
          await saveMarketingSettings({
            autopilot: input.autopilot,
            autoPublish: input.autoPublish,
            postsPerWeek: input.postsPerWeek,
            postHour: input.postHour,
            voice: input.voice,
            weeklyReel: input.weeklyReel,
          }),
        );
      case "generate":
        return respond(
          {
            posts: await generateMarketingPosts({
              count: input.count,
              request: input.request,
              format: input.format,
            }),
          },
          201,
        );
      case "reel":
        return respond(
          await createReel({
            videoUrl: input.videoUrl,
            caption: input.caption,
            theme: input.theme,
          }),
          201,
        );
      case "uploadUrl":
        return respond(await videoUploadUrl(input.fileName));
      case "power":
        return respond(await setMarketingPower(input.enabled));
      case "aiKey":
        return respond(await saveMarketingAiKey(input.key));
      case "aiKeyRemove":
        return respond(await saveMarketingAiKey(null));
      case "model":
        return respond(await setMarketingModel(input.model));
      case "suggest":
        return respond(await suggestMarketing({ note: input.note }));
      case "toReel":
        return respond(await reelFromPost(input.id), 201);
    }
  } catch (error) {
    return failure(error);
  }
}
