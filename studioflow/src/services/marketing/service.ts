import { z } from "zod";
import { appUrl } from "@/lib/app-url";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { checkInstagram, instagramTokenProblem } from "../assistant/instagram";
import { requirePlatformAdmin } from "../platform";
import { isDemo } from "../server-demo";
import { decryptSecret, encryptSecret } from "../server-secrets";
import { generateIdeas, marketingAiConfigured } from "./ai";
import {
  nextSlots,
  rowToPost,
  settingsSchema,
  slideSchema,
  type MarketingPost,
  type MarketingSettings,
} from "./content";
import { mediaInsights, publishToInstagram } from "./instagram";

export interface MarketingState {
  account: { username: string } | null;
  settings: MarketingSettings;
  posts: MarketingPost[];
  ai: boolean;
  demo: boolean;
}

const columns =
  "id,status,format,theme,slides,caption,video_url,scheduled_for,published_at,permalink,error,likes,comments,origin,created_at,updated_at";

export const imageUrl = (post: Pick<MarketingPost, "id" | "updatedAt">, index: number) =>
  `${appUrl}/api/marketing/image/${post.id}/${index}.jpg?v=${Date.parse(post.updatedAt) || 0}`;

function demoOnly() {
  if (isDemo())
    throw new DomainError("O Marketing funciona só no ambiente de produção.", 400);
}

async function readAccount() {
  const { data, error } = await createSupabaseAdmin()
    .from("marketing_account")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new DomainError("Não foi possível ler o Marketing.", 503);
  return data as Record<string, unknown> | null;
}

function settingsOf(row: Record<string, unknown> | null): MarketingSettings {
  return {
    autopilot: !!row?.autopilot,
    autoPublish: !!row?.auto_publish,
    postsPerWeek: Number(row?.posts_per_week ?? 3),
    postHour: Number(row?.post_hour ?? 12),
    voice: (row?.voice as string) || "",
  };
}

export async function marketingState(): Promise<MarketingState> {
  await requirePlatformAdmin();
  if (isDemo())
    return {
      account: null,
      settings: settingsOf(null),
      posts: [],
      ai: marketingAiConfigured(),
      demo: true,
    };
  const account = await readAccount();
  const { data, error } = await createSupabaseAdmin()
    .from("marketing_posts")
    .select(columns)
    .neq("status", "discarded")
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) throw new DomainError("Não foi possível ler os posts.", 503);
  return {
    account: account?.access_token_enc
      ? { username: (account.username as string) || "" }
      : null,
    settings: settingsOf(account),
    posts: (data || []).map(rowToPost),
    ai: marketingAiConfigured(),
    demo: false,
  };
}

export const connectSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, "Cole o token de acesso completo.")
    .max(1000)
    .superRefine((value, ctx) => {
      const problem = instagramTokenProblem(value);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    }),
});

export async function connectMarketingAccount(token: string) {
  await requirePlatformAdmin();
  demoOnly();
  const { igUserId, username } = await checkInstagram(token);
  const { error } = await createSupabaseAdmin()
    .from("marketing_account")
    .upsert({
      id: 1,
      ig_user_id: igUserId,
      username,
      access_token_enc: encryptSecret(token),
      updated_at: new Date().toISOString(),
    });
  if (error) throw new DomainError("Não foi possível salvar a conexão.", 503);
  return { username };
}

export async function disconnectMarketingAccount() {
  await requirePlatformAdmin();
  demoOnly();
  await createSupabaseAdmin()
    .from("marketing_account")
    .update({ ig_user_id: null, username: null, access_token_enc: null, autopilot: false })
    .eq("id", 1);
  return { ok: true };
}

export async function saveMarketingSettings(input: z.infer<typeof settingsSchema>) {
  await requirePlatformAdmin();
  demoOnly();
  const { error } = await createSupabaseAdmin()
    .from("marketing_account")
    .update({
      autopilot: input.autopilot,
      auto_publish: input.autoPublish,
      posts_per_week: input.postsPerWeek,
      post_hour: input.postHour,
      voice: input.voice,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw new DomainError("Não foi possível salvar.", 503);
  return input;
}

async function recentThemes() {
  const { data } = await createSupabaseAdmin()
    .from("marketing_posts")
    .select("theme")
    .order("created_at", { ascending: false })
    .limit(30);
  return (data || []).map((r) => r.theme as string).filter(Boolean);
}

async function insertIdeas(
  ideas: Awaited<ReturnType<typeof generateIdeas>>,
  schedule: string[] = [],
) {
  const rows = ideas.map((idea, i) => ({
    ...idea,
    origin: "ia",
    status: schedule[i] ? "scheduled" : "draft",
    scheduled_for: schedule[i] || null,
  }));
  const { data, error } = await createSupabaseAdmin()
    .from("marketing_posts")
    .insert(rows)
    .select(columns);
  if (error) throw new DomainError("Não foi possível salvar as ideias.", 503);
  return (data || []).map(rowToPost);
}

export const generateSchema = z
  .object({
    count: z.number().int().min(1).max(6).default(3),
    request: z.string().trim().max(500).default(""),
    format: z.enum(["post", "carousel", "story"]).optional(),
  })
  .strict();

export async function generateMarketingPosts(input: z.infer<typeof generateSchema>) {
  await requirePlatformAdmin();
  demoOnly();
  const account = await readAccount();
  const ideas = await generateIdeas({
    count: input.count,
    voice: (account?.voice as string) || "",
    recentThemes: await recentThemes(),
    request: input.request,
    format: input.format,
  });
  return insertIdeas(ideas);
}

export const updateSchema = z
  .object({
    action: z.enum(["save", "schedule", "unschedule", "discard", "retry"]),
    caption: z.string().max(2200).optional(),
    slides: z.array(slideSchema).min(1).max(10).optional(),
    scheduledFor: z.string().datetime({ offset: true }).optional(),
    videoUrl: z.string().url().startsWith("https://").max(1000).nullable().optional(),
  })
  .strict();

export async function updateMarketingPost(id: string, input: z.infer<typeof updateSchema>) {
  await requirePlatformAdmin();
  demoOnly();
  z.string().uuid().parse(id);
  const admin = createSupabaseAdmin();
  const { data: current } = await admin
    .from("marketing_posts")
    .select("status,format,video_url")
    .eq("id", id)
    .maybeSingle();
  if (!current) throw new DomainError("Post não encontrado.", 404);
  if (["published", "publishing"].includes(current.status as string))
    throw new DomainError("Esse post já foi para o Instagram.", 409);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.caption !== undefined) patch.caption = input.caption;
  if (input.slides) patch.slides = input.slides;
  if (input.videoUrl !== undefined) patch.video_url = input.videoUrl;
  if (input.action === "schedule" || input.action === "retry") {
    const at = input.scheduledFor ? new Date(input.scheduledFor) : new Date();
    if (at.getTime() < Date.now() - 60_000 && input.action === "schedule" && input.scheduledFor)
      throw new DomainError("Escolha um horário no futuro.", 400);
    const format = current.format as string;
    const video = input.videoUrl !== undefined ? input.videoUrl : current.video_url;
    if (format === "reel" && !video)
      throw new DomainError("Envie o vídeo antes de agendar o Reel.", 400);
    patch.status = "scheduled";
    patch.scheduled_for = at.toISOString();
    patch.error = null;
  }
  if (input.action === "unschedule") {
    patch.status = "draft";
    patch.scheduled_for = null;
  }
  if (input.action === "discard") patch.status = "discarded";
  const { data, error } = await admin
    .from("marketing_posts")
    .update(patch)
    .eq("id", id)
    .select(columns)
    .single();
  if (error) throw new DomainError("Não foi possível salvar o post.", 503);
  return rowToPost(data);
}

export const createReelSchema = z
  .object({
    videoUrl: z.string().url().startsWith("https://").max(1000),
    caption: z.string().trim().max(2200).default(""),
    theme: z.string().trim().max(200).default("Reel"),
  })
  .strict();

export async function createReel(input: z.infer<typeof createReelSchema>) {
  await requirePlatformAdmin();
  demoOnly();
  const { data, error } = await createSupabaseAdmin()
    .from("marketing_posts")
    .insert({
      format: "reel",
      theme: input.theme,
      caption: input.caption,
      video_url: input.videoUrl,
      origin: "admin",
      slides: [],
    })
    .select(columns)
    .single();
  if (error) throw new DomainError("Não foi possível salvar o Reel.", 503);
  return rowToPost(data);
}

/** Link para o navegador do admin enviar o vídeo direto ao Storage. */
export async function videoUploadUrl(fileName: string) {
  await requirePlatformAdmin();
  demoOnly();
  const ext = /\.(mov)$/i.test(fileName) ? "mov" : "mp4";
  const path = `reels/${crypto.randomUUID()}.${ext}`;
  const storage = createSupabaseAdmin().storage.from("marketing");
  const { data, error } = await storage.createSignedUploadUrl(path);
  if (error || !data) throw new DomainError("Não foi possível preparar o envio.", 503);
  return {
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: storage.getPublicUrl(path).data.publicUrl,
  };
}

export async function marketingPostForImage(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const { data } = await createSupabaseAdmin()
    .from("marketing_posts")
    .select(columns)
    .eq("id", id)
    .maybeSingle();
  return data ? rowToPost(data) : null;
}

async function credentials() {
  const account = await readAccount();
  if (!account?.access_token_enc || !account.ig_user_id) return null;
  return {
    igUserId: account.ig_user_id as string,
    token: decryptSecret(account.access_token_enc as string),
    account,
  };
}

async function publishOne(post: MarketingPost) {
  const admin = createSupabaseAdmin();
  const creds = await credentials();
  try {
    if (!creds) throw new Error("Instagram da StudioFlow não conectado.");
    const result = await publishToInstagram(
      creds.igUserId,
      creds.token,
      post.format === "reel"
        ? { format: "reel", videoUrl: post.videoUrl || "", caption: post.caption }
        : {
            format: post.format,
            imageUrls: post.slides.map((_, i) => imageUrl(post, i)),
            caption: post.caption,
          },
    );
    await admin
      .from("marketing_posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        ig_media_id: result.mediaId,
        permalink: result.permalink,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
    return true;
  } catch (cause) {
    await admin
      .from("marketing_posts")
      .update({
        status: "failed",
        error: (cause instanceof Error ? cause.message : "Falha ao publicar").slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
    return false;
  }
}

/** Publicar agora, pelo admin. */
export async function publishMarketingNow(id: string) {
  await requirePlatformAdmin();
  demoOnly();
  z.string().uuid().parse(id);
  const admin = createSupabaseAdmin();
  const { data: current } = await admin
    .from("marketing_posts")
    .select("format,video_url")
    .eq("id", id)
    .maybeSingle();
  if (!current) throw new DomainError("Post não encontrado.", 404);
  if (current.format === "reel" && !current.video_url)
    throw new DomainError("Envie o vídeo antes de publicar o Reel.", 400);
  const { data, error } = await admin
    .from("marketing_posts")
    .update({ status: "publishing", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "scheduled", "failed"])
    .select(columns)
    .maybeSingle();
  if (error) throw new DomainError("Não foi possível publicar.", 503);
  if (!data) throw new DomainError("Esse post já está sendo publicado.", 409);
  await publishOne(rowToPost(data));
  const { data: after } = await admin.from("marketing_posts").select(columns).eq("id", id).single();
  return rowToPost(after!);
}

/** Roda a cada 15 minutos: publica o que venceu, mantém a fila do piloto automático e lê curtidas. */
export async function runMarketing(now = new Date()) {
  const report = { published: 0, failed: 0, generated: 0, insights: 0 };
  if (isDemo()) return report;
  const admin = createSupabaseAdmin();
  // Posts esquecidos em "publicando" por queda do servidor voltam para a fila.
  await admin
    .from("marketing_posts")
    .update({ status: "scheduled" })
    .eq("status", "publishing")
    .lt("updated_at", new Date(now.getTime() - 20 * 60_000).toISOString());
  for (let i = 0; i < 3; i++) {
    const { data: id } = await admin.rpc("claim_marketing_post");
    if (!id) break;
    const { data } = await admin.from("marketing_posts").select(columns).eq("id", id).single();
    if (!data) continue;
    if (await publishOne(rowToPost(data))) report.published++;
    else report.failed++;
  }
  const creds = await credentials();
  if (!creds) return report;
  const settings = settingsOf(creds.account);
  const last = creds.account.last_generated_at
    ? Date.parse(creds.account.last_generated_at as string)
    : 0;
  if (settings.autopilot && marketingAiConfigured() && now.getTime() - last > 20 * 3_600_000) {
    const week = new Date(now.getTime() + 7 * 86_400_000).toISOString();
    const { data: queued } = await admin
      .from("marketing_posts")
      .select("status,scheduled_for")
      .in("status", ["draft", "scheduled"])
      .gte("created_at", new Date(now.getTime() - 7 * 86_400_000).toISOString());
    const scheduled = (queued || []).filter(
      (p) => p.status === "scheduled" && p.scheduled_for && p.scheduled_for <= week,
    );
    const drafts = (queued || []).filter((p) => p.status === "draft").length;
    const missing = settings.postsPerWeek - scheduled.length - (settings.autoPublish ? 0 : drafts);
    await admin.from("marketing_account").update({ last_generated_at: now.toISOString() }).eq("id", 1);
    if (missing > 0) {
      try {
        const ideas = await generateIdeas({
          count: Math.min(missing, 6),
          voice: settings.voice,
          recentThemes: await recentThemes(),
        });
        const slots = settings.autoPublish
          ? nextSlots(
              ideas.length,
              settings.postHour,
              scheduled.map((p) => p.scheduled_for as string),
              settings.postsPerWeek,
              now,
            )
          : [];
        report.generated = (await insertIdeas(ideas, slots)).length;
      } catch {
        // A IA fora do ar não trava a publicação; tenta de novo no próximo dia.
      }
    }
  }
  if (now.getUTCMinutes() < 15) {
    const { data: recent } = await admin
      .from("marketing_posts")
      .select("id,ig_media_id")
      .eq("status", "published")
      .gte("published_at", new Date(now.getTime() - 30 * 86_400_000).toISOString())
      .not("ig_media_id", "is", null)
      .limit(30);
    for (const row of recent || []) {
      try {
        const m = await mediaInsights(row.ig_media_id as string, creds.token);
        await admin
          .from("marketing_posts")
          .update({ likes: m.like_count ?? null, comments: m.comments_count ?? null })
          .eq("id", row.id);
        report.insights++;
      } catch {
        // Post apagado no Instagram ou token sem permissão: segue.
      }
    }
  }
  return report;
}

/** Renova o token da conta da StudioFlow (dura 60 dias). */
export async function refreshMarketingToken() {
  const creds = await credentials().catch(() => null);
  if (!creds) return false;
  const updated = Date.parse((creds.account.updated_at as string) || "") || 0;
  if (Date.now() - updated < 7 * 86_400_000) return false;
  try {
    const response = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(creds.token)}`,
      { signal: AbortSignal.timeout(10_000), cache: "no-store" },
    );
    const body = (await response.json().catch(() => ({}))) as { access_token?: string };
    if (!response.ok || !body.access_token) return false;
    await createSupabaseAdmin()
      .from("marketing_account")
      .update({ access_token_enc: encryptSecret(body.access_token), updated_at: new Date().toISOString() })
      .eq("id", 1);
    return true;
  } catch {
    return false;
  }
}
