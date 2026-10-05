import { z } from "zod";
import { assertPublicOpen } from "@/lib/access";
import { DomainError } from "@/lib/availability";
import {
  createSupabaseAdmin,
  readBusinessAccess,
  requireMembership,
} from "@/lib/supabase/server";
import type { Store } from "@/types";
import { checkInstagram, instagramVersion } from "./assistant/instagram";
import { isDemo, readDemo } from "./server-demo";
import { decryptSecret, encryptSecret } from "./server-secrets";

/** Posts do Instagram que a página pública mostra. Só dados já públicos. */
export interface InstagramPost {
  id: string;
  image: string;
  permalink: string;
  type: "image" | "video" | "carousel";
  caption: string;
}
export interface InstagramFeed {
  /** false = sem conta ligada: a página mostra só o @ e as fotos da casa. */
  connected: boolean;
  username: string;
  name: string;
  avatar: string;
  followers: number | null;
  postsCount: number | null;
  posts: InstagramPost[];
}

export const instagramFeedSchema = z.object({
  token: z.string().trim().min(20, "Cole o token de acesso completo.").max(1000),
});

const base = `https://graph.instagram.com/${instagramVersion}`;
const fresh = 15 * 60_000;
const retry = 5 * 60_000;
const cache = new Map<string, { at: number; ttl: number; feed: InstagramFeed | null }>();
const editors = ["owner", "admin", "manager"];

const handle = (value: string) =>
  value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0];
const empty = (username: string): InstagramFeed => ({
  connected: false,
  username,
  name: "",
  avatar: "",
  followers: null,
  postsCount: null,
  posts: [],
});
const shortCaption = (text?: string) => {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  return clean.length > 140 ? `${clean.slice(0, 137)}…` : clean;
};

async function graph<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message || `Instagram ${response.status}`);
  return data;
}

/** Perfil e os 12 posts mais recentes da conta, pela API oficial. */
export async function fetchInstagramFeed(token: string): Promise<InstagramFeed> {
  const [profile, media] = await Promise.all([
    graph<{
      username?: string;
      name?: string;
      profile_picture_url?: string;
      followers_count?: number;
      media_count?: number;
    }>("/me?fields=user_id,username,name,profile_picture_url,followers_count,media_count", token),
    graph<{
      data?: {
        id: string;
        caption?: string;
        media_type?: string;
        media_url?: string;
        thumbnail_url?: string;
        permalink?: string;
      }[];
    }>("/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&limit=12", token),
  ]);
  return {
    connected: true,
    username: profile.username || "",
    name: profile.name || "",
    avatar: profile.profile_picture_url || "",
    followers: profile.followers_count ?? null,
    postsCount: profile.media_count ?? null,
    posts: (media.data || [])
      .map((item): InstagramPost => ({
        id: item.id,
        image: (item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url) || "",
        permalink: item.permalink || "",
        type:
          item.media_type === "VIDEO"
            ? "video"
            : item.media_type === "CAROUSEL_ALBUM"
              ? "carousel"
              : "image",
        caption: shortCaption(item.caption),
      }))
      .filter((post) => post.image.startsWith("https://") && post.permalink.startsWith("https://")),
  };
}

/** Demonstração: as fotos da casa fazem o papel dos posts. */
function demoFeed(store: Store): InstagramFeed {
  const photos = [
    ...(store.business.photos || []),
    ...store.services.map((service) => service.image),
  ].filter(Boolean);
  const username = handle(store.business.instagram) || store.business.slug;
  return {
    connected: true,
    username,
    name: store.business.name,
    avatar: store.business.logo || store.business.cover || "",
    followers: 1284,
    postsCount: photos.length,
    posts: [...new Set(photos)].slice(0, 12).map((image, index) => ({
      id: `demo-${index}`,
      image,
      permalink: `https://instagram.com/${username}`,
      type: index === 1 ? "carousel" : index === 4 ? "video" : "image",
      caption: "",
    })),
  };
}

/** O token que mostra os posts: o da página ou, se não houver, o da recepcionista. */
async function feedToken(businessId: string) {
  const admin = createSupabaseAdmin();
  const own = await admin
    .from("instagram_feeds")
    .select("access_token_enc")
    .eq("business_id", businessId)
    .maybeSingle();
  if (own.data?.access_token_enc) return decryptSecret(own.data.access_token_enc as string);
  const assistant = await admin
    .from("instagram_accounts")
    .select("access_token_enc")
    .eq("business_id", businessId)
    .maybeSingle();
  return assistant.data?.access_token_enc
    ? decryptSecret(assistant.data.access_token_enc as string)
    : null;
}

export async function publicInstagramFeed(slug: string): Promise<InstagramFeed> {
  if (isDemo()) {
    const store = await readDemo(slug);
    assertPublicOpen(store.access ?? { status: "active", until: null });
    return demoFeed(store);
  }
  const { data: business } = await createSupabaseAdmin()
    .from("businesses")
    .select("id,instagram")
    .eq("slug", slug)
    .maybeSingle();
  if (!business) throw new DomainError("Estabelecimento não encontrado.", 404);
  assertPublicOpen(await readBusinessAccess(business.id));
  const username = handle((business.instagram as string) || "");
  const hit = cache.get(business.id);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.feed || empty(username);
  let feed: InstagramFeed | null = null;
  try {
    const token = await feedToken(business.id);
    if (token) feed = await fetchInstagramFeed(token);
  } catch {
    // Token vencido ou a Meta fora do ar: a página segue com o @.
    feed = null;
  }
  if (cache.size > 2000) cache.clear();
  cache.set(business.id, { at: Date.now(), ttl: feed ? fresh : retry, feed });
  return feed || empty(username);
}

async function editor() {
  const membership = await requireMembership();
  if (!editors.includes(membership.role))
    throw new DomainError("Seu perfil não pode fazer isso.", 403);
  return membership;
}

/** Liga a conta do Instagram que mostra os posts na página. */
export async function connectInstagramFeed(input: z.infer<typeof instagramFeedSchema>) {
  if (isDemo())
    throw new DomainError("A conexão com o Instagram funciona só no ambiente de produção.", 400);
  const { businessId } = await editor();
  const { igUserId, username } = await checkInstagram(input.token);
  // Também confere se o token lê os posts, não só o perfil.
  try {
    await fetchInstagramFeed(input.token);
  } catch (cause) {
    throw new DomainError(
      `A Meta não liberou os posts: ${cause instanceof Error ? cause.message : "confira as permissões do token."}`,
      400,
    );
  }
  const admin = createSupabaseAdmin();
  const { data: business } = await admin
    .from("businesses")
    .select("tenant_id")
    .eq("id", businessId)
    .single();
  const { error } = await admin.from("instagram_feeds").upsert({
    business_id: businessId,
    tenant_id: business!.tenant_id,
    ig_user_id: igUserId,
    username,
    access_token_enc: encryptSecret(input.token),
  });
  if (error) throw new DomainError("Não foi possível salvar a conexão.", 503);
  cache.delete(businessId);
  return { username };
}

export async function disconnectInstagramFeed() {
  if (isDemo()) return { ok: true };
  const { businessId } = await editor();
  await createSupabaseAdmin().from("instagram_feeds").delete().eq("business_id", businessId);
  cache.delete(businessId);
  return { ok: true };
}

/** O que o painel mostra: qual conta alimenta os posts da página. */
export async function readInstagramFeedStatus(businessId: string) {
  const admin = createSupabaseAdmin();
  const [own, assistant] = await Promise.all([
    admin.from("instagram_feeds").select("username").eq("business_id", businessId).maybeSingle(),
    admin.from("instagram_accounts").select("username").eq("business_id", businessId).maybeSingle(),
  ]);
  if (!own.error && own.data) return { username: own.data.username as string, source: "page" as const };
  if (!assistant.error && assistant.data)
    return { username: assistant.data.username as string, source: "assistant" as const };
  return null;
}
