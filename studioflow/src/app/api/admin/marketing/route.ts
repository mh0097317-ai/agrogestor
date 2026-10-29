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
  generateMarketingVideoSchema,
  aiKeySchema,
  marketingState,
  modelSchema,
  reelFromPost,
  saveMarketingAiKey,
  saveMarketingSettings,
  setMarketingModel,
  setMarketingPower,
  suggestMarketing,
  suggestMarketingVoice,
  suggestSchema,
  voiceSchema,
  videoUploadUrl,
  googleVideoKeySchema,
  saveGoogleVideoKey,
  startMarketingVideo,
  checkMarketingVideo,
  createManualPhoto,
  manualPhotoSchema,
  photoUploadUrl,
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
  z.object({ kind: z.literal("photoUploadUrl"), contentType: z.enum(["image/jpeg", "image/png"]) }),
  manualPhotoSchema.extend({ kind: z.literal("manualPhoto") }),
  z.object({ kind: z.literal("power"), enabled: z.boolean() }),
  aiKeySchema.extend({ kind: z.literal("aiKey") }),
  z.object({ kind: z.literal("aiKeyRemove") }),
  modelSchema.extend({ kind: z.literal("model") }),
  z.object({ kind: z.literal("toReel"), id: z.string().uuid() }),
  suggestSchema.extend({ kind: z.literal("suggest") }),
  voiceSchema.extend({ kind: z.literal("suggestVoice") }),
  googleVideoKeySchema.extend({ kind: z.literal("videoAiKey") }),
  z.object({ kind: z.literal("videoAiKeyRemove") }),
  generateMarketingVideoSchema.extend({ kind: z.literal("generateVideo") }),
  z.object({ kind: z.literal("checkVideo") }).extend({ id: z.string().uuid() }),
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
            postDays: input.postDays,
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
      case "photoUploadUrl":
        return respond(await photoUploadUrl(input.contentType));
      case "manualPhoto":
        return respond(await createManualPhoto(input), 201);
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
      case "suggestVoice":
        return respond(await suggestMarketingVoice({ current: input.current }));
      case "videoAiKey":
        return respond(await saveGoogleVideoKey(input.key));
      case "videoAiKeyRemove":
        return respond(await saveGoogleVideoKey(null));
      case "generateVideo":
        return respond(await startMarketingVideo(input), 201);
      case "checkVideo":
        return respond(await checkMarketingVideo(input.id));
      case "toReel":
        return respond(await reelFromPost(input.id), 201);
    }
  } catch (error) {
    return failure(error);
  }
}
