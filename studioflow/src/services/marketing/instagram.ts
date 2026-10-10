import { instagramVersion } from "../assistant/instagram";

/** Publicação na conta do Instagram da StudioFlow (API com login do Instagram). */
const base = `https://graph.instagram.com/${instagramVersion}`;

async function call<T>(
  path: string,
  token: string,
  params: Record<string, string>,
  method: "GET" | "POST" = "POST",
): Promise<T> {
  const query = new URLSearchParams({ ...params, access_token: token });
  const response = await fetch(
    method === "GET" ? `${base}${path}?${query}` : `${base}${path}`,
    {
      method,
      headers:
        method === "POST"
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : undefined,
      body: method === "POST" ? query : undefined,
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    },
  );
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(data.error?.message || `Instagram ${response.status}`);
  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera a Meta terminar de processar o contêiner (vídeo e carrossel demoram). */
async function waitReady(id: string, token: string, timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const { status_code } = await call<{ status_code?: string }>(
      `/${id}`,
      token,
      { fields: "status_code" },
      "GET",
    );
    if (status_code === "FINISHED" || !status_code) return;
    if (status_code === "ERROR" || status_code === "EXPIRED")
      throw new Error(`A Meta não processou a mídia (${status_code}).`);
    await sleep(4000);
  }
  throw new Error("A Meta demorou demais para processar a mídia.");
}

export type PublishInput =
  | { format: "post" | "story"; imageUrls: string[]; caption: string }
  | { format: "carousel"; imageUrls: string[]; caption: string }
  | { format: "reel"; videoUrl: string; caption: string };

export async function publishToInstagram(
  igUserId: string,
  token: string,
  input: PublishInput,
) {
  let creation: string;
  if (input.format === "carousel") {
    const children: string[] = [];
    for (const url of input.imageUrls.slice(0, 10)) {
      const child = await call<{ id: string }>(`/${igUserId}/media`, token, {
        image_url: url,
        is_carousel_item: "true",
      });
      children.push(child.id);
    }
    for (const id of children) await waitReady(id, token, 60_000);
    creation = (
      await call<{ id: string }>(`/${igUserId}/media`, token, {
        media_type: "CAROUSEL",
        children: children.join(","),
        caption: input.caption,
      })
    ).id;
    await waitReady(creation, token, 60_000);
  } else if (input.format === "reel") {
    creation = (
      await call<{ id: string }>(`/${igUserId}/media`, token, {
        media_type: "REELS",
        video_url: input.videoUrl,
        caption: input.caption,
        share_to_feed: "true",
      })
    ).id;
    await waitReady(creation, token, 240_000);
  } else {
    creation = (
      await call<{ id: string }>(`/${igUserId}/media`, token, {
        image_url: input.imageUrls[0],
        ...(input.format === "story"
          ? { media_type: "STORIES" }
          : { caption: input.caption }),
      })
    ).id;
    await waitReady(creation, token, 60_000);
  }
  const published = await call<{ id: string }>(
    `/${igUserId}/media_publish`,
    token,
    { creation_id: creation },
  );
  const info = await call<{ permalink?: string }>(
    `/${published.id}`,
    token,
    { fields: "permalink" },
    "GET",
  ).catch(() => ({ permalink: undefined }));
  return { mediaId: published.id, permalink: info.permalink || null };
}

export async function mediaInsights(mediaId: string, token: string) {
  return call<{ like_count?: number; comments_count?: number }>(
    `/${mediaId}`,
    token,
    { fields: "like_count,comments_count" },
    "GET",
  );
}
