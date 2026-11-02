import type { PublishInput } from "./instagram";

/*
 * Zernio: publica no Instagram da StudioFlow e traz as métricas. A conta é
 * conectada uma vez pelo login oficial do Instagram na própria Zernio, que
 * guarda e renova o acesso. Aqui só chamamos a API REST com a chave.
 * Documentação: https://zernio.com/llms.txt
 */

const base = "https://zernio.com/api/v1";

export class ZernioError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** "key": a chave da Zernio. "account": o Instagram precisa reconectar. */
    readonly kind: "key" | "account" | "other" = "other",
  ) {
    super(message);
  }
}

export const ZERNIO_KEY_MESSAGE =
  "A Zernio recusou a chave. Crie uma nova no painel da Zernio e salve no Marketing.";
export const ZERNIO_ACCOUNT_MESSAGE =
  "A Zernio perdeu o acesso ao Instagram. Clique em Reconectar no Marketing e autorize de novo.";

/** Chave com cara de chave da Zernio (sk_ + 64 hexadecimais). */
export const zernioKeyLooksValid = (key: string) => /^sk_[A-Za-z0-9]{20,200}$/.test(key.trim());

type Query = Record<string, string | undefined>;

async function call<T>(
  key: string,
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; query?: Query; timeoutMs?: number; idempotencyKey?: string } = {},
): Promise<{ status: number; data: T }> {
  const url = new URL(base + path);
  for (const [name, value] of Object.entries(init.query || {})) if (value) url.searchParams.set(name, value);
  const response = await fetch(url, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
  }).catch(() => null);
  if (!response) throw new ZernioError("A Zernio não respondeu a tempo. Tente de novo.", 502);
  const data = (await response.json().catch(() => ({}))) as T & { error?: unknown; code?: string };
  if (response.ok) return { status: response.status, data };
  const detail = typeof data?.error === "string" ? data.error : "";
  const code = typeof data?.code === "string" ? data.code : "";
  if (response.status === 401 && /reconnect/i.test(`${code} ${detail}`))
    throw new ZernioError(ZERNIO_ACCOUNT_MESSAGE, 401, "account");
  if (response.status === 401) throw new ZernioError(ZERNIO_KEY_MESSAGE, 401, "key");
  if (response.status === 429)
    throw new ZernioError("A Zernio pediu para esperar um pouco (limite de chamadas). Tente em 1 minuto.", 429);
  throw new ZernioError(
    detail ? `A Zernio respondeu: ${detail.slice(0, 240)}` : `A Zernio não conseguiu agora (${response.status}).`,
    response.status,
    /reconnect|token.*(expired|invalid)|permission/i.test(detail) ? "account" : "other",
  );
}

export interface ZernioAccount {
  id: string;
  username: string;
  displayName: string;
  picture: string;
  needsReconnection: boolean;
  followers: number | null;
}

const handle = (value: unknown) => String(value || "").replace(/^@/, "").slice(0, 100);

/** O perfil padrão da conta da Zernio (onde as redes ficam conectadas). */
export async function zernioDefaultProfile(key: string) {
  const { data } = await call<{ profiles?: { _id: string; isDefault?: boolean; name?: string }[] }>(key, "/profiles");
  const profiles = data.profiles || [];
  const profile = profiles.find((item) => item.isDefault) || profiles[0];
  if (!profile?._id) throw new ZernioError("Crie um perfil no painel da Zernio primeiro.", 409);
  return profile._id;
}

/** Contas de Instagram conectadas na Zernio. */
export async function zernioInstagramAccounts(key: string, profileId?: string): Promise<ZernioAccount[]> {
  const { data } = await call<{ accounts?: Record<string, unknown>[] }>(key, "/accounts", {
    query: { platform: "instagram", profileId },
  });
  return (data.accounts || [])
    .filter((item) => item.platform === "instagram" && item.isActive !== false && item.enabled !== false)
    .map((item) => ({
      id: String(item._id),
      username: handle(item.username),
      displayName: String(item.displayName || "").slice(0, 100),
      picture: typeof item.profilePicture === "string" ? item.profilePicture : "",
      needsReconnection: item.needsReconnection === true,
      followers: typeof item.followersCount === "number" ? item.followersCount : null,
    }));
}

/** Link do login oficial do Instagram, para conectar ou reconectar a conta. */
export async function zernioConnectUrl(
  key: string,
  input: { profileId: string; redirectUrl: string; reconnectAccountId?: string | null },
) {
  const { data } = await call<{ authUrl?: string }>(key, "/connect/instagram", {
    query: {
      profileId: input.profileId,
      redirect_url: input.redirectUrl,
      reconnectAccountId: input.reconnectAccountId || undefined,
    },
  });
  if (!data.authUrl || !/^https:\/\//.test(data.authUrl))
    throw new ZernioError("A Zernio não devolveu o link de conexão. Tente de novo.", 502);
  return data.authUrl;
}

/** Corpo do POST /posts: o mesmo post que a StudioFlow montou, no formato da Zernio. */
export function zernioPostBody(accountId: string, input: PublishInput) {
  const platform = { platform: "instagram", accountId } as {
    platform: "instagram";
    accountId: string;
    platformSpecificData?: Record<string, unknown>;
  };
  if (input.format === "reel") {
    platform.platformSpecificData = { shareToFeed: true };
    return {
      content: input.caption,
      publishNow: true,
      platforms: [platform],
      mediaItems: [{ type: "video", url: input.videoUrl }],
    };
  }
  if (input.format === "story") {
    // Story não tem legenda: vai só a imagem.
    platform.platformSpecificData = { contentType: "story" };
    return {
      publishNow: true,
      platforms: [platform],
      mediaItems: [{ type: "image", url: input.imageUrls[0] }],
    };
  }
  const urls = input.format === "carousel" ? input.imageUrls.slice(0, 10) : input.imageUrls.slice(0, 1);
  return {
    content: input.caption,
    publishNow: true,
    platforms: [platform],
    mediaItems: urls.map((url) => ({ type: "image", url })),
  };
}

type ZernioPost = {
  _id?: string;
  status?: string;
  platforms?: {
    platform?: string;
    status?: string;
    platformPostId?: string;
    platformPostUrl?: string;
    errorMessage?: string;
  }[];
};

export type ZernioOutcome =
  | { state: "published"; postId: string; mediaId: string | null; permalink: string | null }
  | { state: "pending"; postId: string }
  | { state: "failed"; postId: string | null; error: string; accountProblem: boolean };

/** Lê o resultado de um post (na criação ou depois, enquanto a Zernio tenta de novo). */
export function zernioOutcome(post: ZernioPost | undefined, fallbackError = ""): ZernioOutcome {
  const postId = post?._id ? String(post._id) : null;
  const target = post?.platforms?.find((item) => item.platform === "instagram") || post?.platforms?.[0];
  const status = target?.status || post?.status || "";
  if (postId && (status === "published" || post?.status === "published"))
    return {
      state: "published",
      postId,
      mediaId: target?.platformPostId ? String(target.platformPostId) : null,
      permalink: target?.platformPostUrl && /^https:\/\//.test(target.platformPostUrl) ? target.platformPostUrl : null,
    };
  if (postId && ["pending", "scheduled", "publishing", "processing"].includes(status))
    return { state: "pending", postId };
  const error = (target?.errorMessage || fallbackError || "A Zernio não conseguiu publicar.").slice(0, 400);
  return {
    state: "failed",
    postId,
    error: `Instagram (pela Zernio): ${error}`,
    accountProblem: /reconnect|expired|token|permission|authoriz/i.test(error),
  };
}

/** Publica agora. Repetir a mesma chave de tentativa não publica duas vezes. */
export async function zernioPublish(key: string, accountId: string, input: PublishInput, attempt: string) {
  const { data } = await call<{ post?: ZernioPost; error?: string }>(key, "/posts", {
    method: "POST",
    body: zernioPostBody(accountId, input),
    // Reel: o Instagram processa o vídeo dentro do pedido.
    timeoutMs: input.format === "reel" ? 250_000 : 120_000,
    idempotencyKey: `studioflow-marketing-${attempt}`,
  });
  return zernioOutcome(data.post, typeof data.error === "string" ? data.error : "");
}

/** Situação de um post que a Zernio ainda estava tentando publicar. */
export async function zernioPostStatus(key: string, postId: string) {
  const { data } = await call<{ post?: ZernioPost } & ZernioPost>(key, `/posts/${encodeURIComponent(postId)}`);
  return zernioOutcome(data.post || data);
}

export interface ZernioMetrics {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
}

const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null);

/** Métricas de um post publicado; null enquanto a Zernio ainda sincroniza. */
export async function zernioMetrics(key: string, postId: string): Promise<ZernioMetrics | null> {
  const { status, data } = await call<{ analytics?: Record<string, unknown> }>(key, "/analytics", {
    query: { postId },
  });
  if (status === 202 || !data.analytics) return null;
  const a = data.analytics;
  return {
    views: count(a.views) || count(a.impressions),
    reach: count(a.reach),
    likes: count(a.likes),
    comments: count(a.comments),
    saves: count(a.saves),
    shares: count(a.shares),
  };
}
