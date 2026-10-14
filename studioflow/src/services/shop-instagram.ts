import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin, requireMembership } from "@/lib/supabase/server";
import { publishToInstagram } from "./marketing/instagram";
import { isDemo } from "./server-demo";
import { decryptSecret } from "./server-secrets";

/*
 * Divulgar → Postar no Instagram. A arte é feita no navegador (as mesmas do
 * kit e do story das vagas), sobe para um bucket público só até a Meta
 * buscar, e o servidor publica com a conta que a casa ligou. Sem IA.
 */

const editors = ["owner", "admin", "manager"];
const bucket = "shop-posts";
/** Bem abaixo do limite da Meta (100 por dia): evita postar repetido sem querer. */
const DAILY_LIMIT = 10;

async function editor() {
  const membership = await requireMembership();
  if (!editors.includes(membership.role))
    throw new DomainError("Seu perfil não pode publicar no Instagram da casa.", 403);
  if (isDemo())
    throw new DomainError("Na demonstração, baixe a imagem. A publicação funciona no app publicado.", 400);
  return membership.businessId;
}

/** A conta ligada nos posts da página ou, se não houver, a da recepcionista. */
async function account(businessId: string) {
  const admin = createSupabaseAdmin();
  for (const table of ["instagram_feeds", "instagram_accounts"] as const) {
    const { data } = await admin
      .from(table)
      .select("ig_user_id,access_token_enc")
      .eq("business_id", businessId)
      .maybeSingle();
    if (data?.ig_user_id && data.access_token_enc)
      return {
        igUserId: data.ig_user_id as string,
        token: decryptSecret(data.access_token_enc as string),
      };
  }
  return null;
}

export async function shopPostUploadUrl() {
  const businessId = await editor();
  if (!(await account(businessId)))
    throw new DomainError("Conecte o Instagram da casa primeiro.", 409);
  const path = `${businessId}/${crypto.randomUUID()}.jpg`;
  const { data, error } = await createSupabaseAdmin()
    .storage.from(bucket)
    .createSignedUploadUrl(path);
  if (error || !data) throw new DomainError("Não foi possível preparar a imagem.", 503);
  return { path, signedUrl: data.signedUrl };
}

export const shopPostSchema = z.object({
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/),
  format: z.enum(["post", "story"]),
  kind: z.string().trim().max(40).default(""),
  caption: z.string().trim().max(2200).default(""),
});

export async function publishShopPost(input: z.infer<typeof shopPostSchema>) {
  const businessId = await editor();
  if (!input.path.startsWith(`${businessId}/`))
    throw new DomainError("Imagem inválida.", 400);
  const admin = createSupabaseAdmin();
  const storage = admin.storage.from(bucket);
  try {
    const creds = await account(businessId);
    if (!creds) throw new DomainError("Conecte o Instagram da casa primeiro.", 409);
    const { count } = await admin
      .from("shop_instagram_posts")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
    if ((count ?? 0) >= DAILY_LIMIT)
      throw new DomainError(`Limite de ${DAILY_LIMIT} publicações por dia. Tente amanhã.`, 429);
    let result;
    try {
      result = await publishToInstagram(creds.igUserId, creds.token, {
        format: input.format,
        imageUrls: [storage.getPublicUrl(input.path).data.publicUrl],
        caption: input.caption,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      throw new DomainError(
        /permission|scope|OAuth/i.test(message)
          ? "O token do Instagram não tem permissão para publicar. Gere um token novo com a permissão de publicar conteúdo e conecte de novo."
          : `O Instagram não aceitou a publicação${message ? `: ${message}` : "."}`,
        502,
      );
    }
    await admin.from("shop_instagram_posts").insert({
      business_id: businessId,
      format: input.format,
      kind: input.kind,
      media_id: result.mediaId,
      permalink: result.permalink,
    });
    return result;
  } finally {
    // A Meta já copiou a imagem (ou falhou): o arquivo público não fica.
    await storage.remove([input.path]).catch(() => undefined);
  }
}
