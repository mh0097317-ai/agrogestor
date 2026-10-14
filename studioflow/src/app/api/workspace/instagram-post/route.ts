import { z } from "zod";
import { auditPanel } from "@/services/activity";
import {
  publishShopPost,
  shopPostSchema,
  shopPostUploadUrl,
} from "@/services/shop-instagram";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const action = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("uploadUrl") }),
  shopPostSchema.omit({ kind: true }).extend({
    kind: z.literal("publish"),
    piece: z.string().trim().max(40).default(""),
  }),
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = action.parse(await request.json());
    if (input.kind === "uploadUrl") return respond(await shopPostUploadUrl());
    const result = await publishShopPost({
      path: input.path,
      format: input.format,
      kind: input.piece,
      caption: input.caption,
    });
    auditPanel(input.format === "story" ? "Publicou um story no Instagram" : "Publicou um post no Instagram");
    return respond(result, 201);
  } catch (error) {
    return failure(error);
  }
}
