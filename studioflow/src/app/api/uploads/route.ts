import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@/lib/availability";
import {
  createSupabaseAdmin,
  createSupabaseServer,
  requireMembership,
} from "@/lib/supabase/server";
import { isDemo } from "@/services/server-demo";
import { assertSameOrigin, failure, respond } from "@/services/server-http";

export const dynamic = "force-dynamic";

const uploadSchema = z.object({
  image: z
    .string()
    .max(3_000_000, "A foto ficou grande demais. Tente outra imagem.")
    .regex(
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/,
      "Envie uma foto JPG, PNG ou WebP.",
    ),
});
const editors = new Set(["owner", "admin", "manager"]);

/**
 * Stores a photo the panel already resized in the browser and returns its
 * public URL. Owners and managers upload into their business folder; a
 * signed-in person without a business yet (onboarding cover) uploads into
 * a folder of their own.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { image } = uploadSchema.parse(await request.json());
    // The local demo keeps photos inline; only real projects use Storage.
    if (isDemo()) return respond({ url: image });

    const folder = await uploadFolder();
    const [, type, data] =
      /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(image) ?? [];
    const bytes = Buffer.from(data, "base64");
    const path = `${folder}/${randomUUID()}.${type === "jpeg" ? "jpg" : type}`;
    const storage = createSupabaseAdmin().storage.from("images");
    const { error: uploadError } = await storage.upload(path, bytes, {
      contentType: `image/${type}`,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError)
      throw new DomainError(
        "Não foi possível salvar a foto. Tente de novo.",
        502,
      );
    return respond({ url: storage.getPublicUrl(path).data.publicUrl }, 201);
  } catch (error) {
    return failure(error);
  }
}

async function uploadFolder() {
  let membership: Awaited<ReturnType<typeof requireMembership>> | undefined;
  try {
    membership = await requireMembership();
  } catch (cause) {
    // 403 here means "signed in, business not created yet" (onboarding).
    if (!(cause instanceof DomainError) || cause.status !== 403) throw cause;
  }
  if (membership) {
    if (!editors.has(membership.role))
      throw new DomainError("Seu perfil não pode alterar fotos.", 403);
    return membership.businessId;
  }
  const client = await createSupabaseServer();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    throw new DomainError("Entre na sua conta para enviar fotos.", 401);
  return `onboarding/${user.id}`;
}
