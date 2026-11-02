import test from "node:test";
import assert from "node:assert/strict";
import {
  ZernioError,
  zernioConnectUrl,
  zernioInstagramAccounts,
  zernioKeyLooksValid,
  zernioMetrics,
  zernioOutcome,
  zernioPostBody,
  zernioPublish,
} from "../src/services/marketing/zernio";

type Call = { url: string; init: RequestInit };

function mockFetch(responses: { status: number; body: unknown }[]) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init || {} });
    const next = responses.shift() || { status: 500, body: {} };
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const KEY = `sk_${"a".repeat(64)}`;

test("zernio: monta o post de cada formato do Marketing", () => {
  const carousel = zernioPostBody("acc1", {
    format: "carousel",
    imageUrls: Array.from({ length: 12 }, (_, i) => `https://app.test/${i}.jpg`),
    caption: "Legenda",
  });
  assert.equal(carousel.publishNow, true);
  assert.equal(carousel.content, "Legenda");
  assert.equal(carousel.mediaItems.length, 10);
  assert.deepEqual(carousel.platforms, [{ platform: "instagram", accountId: "acc1" }]);

  const post = zernioPostBody("acc1", { format: "post", imageUrls: ["https://a/1.jpg", "https://a/2.jpg"], caption: "Oi" });
  assert.equal(post.mediaItems.length, 1);

  const story = zernioPostBody("acc1", { format: "story", imageUrls: ["https://a/1.jpg"], caption: "não vai" });
  assert.equal("content" in story, false);
  assert.deepEqual(story.platforms[0].platformSpecificData, { contentType: "story" });

  const reel = zernioPostBody("acc1", { format: "reel", videoUrl: "https://a/v.mp4", caption: "Reel" });
  assert.deepEqual(reel.mediaItems, [{ type: "video", url: "https://a/v.mp4" }]);
  assert.deepEqual(reel.platforms[0].platformSpecificData, { shareToFeed: true });
});

test("zernio: lê publicado, em andamento e falha", () => {
  assert.deepEqual(
    zernioOutcome({
      _id: "p1",
      status: "published",
      platforms: [{ platform: "instagram", status: "published", platformPostId: "178", platformPostUrl: "https://www.instagram.com/p/abc/" }],
    }),
    { state: "published", postId: "p1", mediaId: "178", permalink: "https://www.instagram.com/p/abc/" },
  );
  assert.deepEqual(zernioOutcome({ _id: "p2", status: "scheduled", platforms: [{ platform: "instagram", status: "pending" }] }), {
    state: "pending",
    postId: "p2",
  });
  const failed = zernioOutcome({ _id: "p3", status: "failed", platforms: [{ platform: "instagram", status: "failed", errorMessage: "Media aspect ratio invalid" }] });
  assert.equal(failed.state, "failed");
  assert.ok(failed.state === "failed" && failed.error.includes("aspect ratio") && !failed.accountProblem);
  const expired = zernioOutcome({ _id: "p4", status: "failed", platforms: [{ platform: "instagram", status: "failed", errorMessage: "Token expired, reconnect" }] });
  assert.ok(expired.state === "failed" && expired.accountProblem);
});

test("zernio: chave com cara de chave", () => {
  assert.equal(zernioKeyLooksValid(KEY), true);
  assert.equal(zernioKeyLooksValid("sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx"), false);
  assert.equal(zernioKeyLooksValid("sk_curta"), false);
});

test("zernio: publica com a chave no cabeçalho e repete a mesma tentativa", async () => {
  const fake = mockFetch([
    {
      status: 201,
      body: { post: { _id: "p1", status: "published", platforms: [{ platform: "instagram", status: "published", platformPostUrl: "https://www.instagram.com/p/x/" }] } },
    },
  ]);
  try {
    const outcome = await zernioPublish(KEY, "acc1", { format: "post", imageUrls: ["https://a/1.jpg"], caption: "Oi" }, "try-1");
    assert.equal(outcome.state, "published");
    const headers = fake.calls[0].init.headers as Record<string, string>;
    assert.equal(fake.calls[0].url, "https://zernio.com/api/v1/posts");
    assert.equal(headers.Authorization, `Bearer ${KEY}`);
    assert.equal(headers["Idempotency-Key"], "studioflow-marketing-try-1");
    assert.equal(JSON.parse(String(fake.calls[0].init.body)).platforms[0].accountId, "acc1");
  } finally {
    fake.restore();
  }
});

test("zernio: 207 com falha vira erro legível, não sucesso", async () => {
  const fake = mockFetch([
    { status: 207, body: { post: { _id: "p9", status: "failed", platforms: [{ platform: "instagram", status: "failed", errorMessage: "Video too long" }] } } },
  ]);
  try {
    const outcome = await zernioPublish(KEY, "acc1", { format: "reel", videoUrl: "https://a/v.mp4", caption: "" }, "t");
    assert.equal(outcome.state, "failed");
  } finally {
    fake.restore();
  }
});

test("zernio: separa chave recusada de Instagram para reconectar", async () => {
  let fake = mockFetch([{ status: 401, body: { error: "Invalid API key", code: "invalid_credentials" } }]);
  try {
    await assert.rejects(zernioInstagramAccounts(KEY), (cause: unknown) => cause instanceof ZernioError && cause.kind === "key");
  } finally {
    fake.restore();
  }
  fake = mockFetch([{ status: 401, body: { error: "Instagram token expired", code: "reconnect_required" } }]);
  try {
    await assert.rejects(zernioInstagramAccounts(KEY), (cause: unknown) => cause instanceof ZernioError && cause.kind === "account");
  } finally {
    fake.restore();
  }
});

test("zernio: lista só Instagram ativo e monta o link de conexão", async () => {
  const fake = mockFetch([
    {
      status: 200,
      body: {
        accounts: [
          { _id: "a1", platform: "instagram", username: "@studioflow", isActive: true, needsReconnection: false, followersCount: 120 },
          { _id: "a2", platform: "instagram", username: "antiga", isActive: false },
          { _id: "a3", platform: "tiktok", username: "x", isActive: true },
        ],
      },
    },
    { status: 200, body: { authUrl: "https://www.instagram.com/oauth/authorize?x=1", state: "s" } },
  ]);
  try {
    const list = await zernioInstagramAccounts(KEY, "prof1");
    assert.deepEqual(list.map((item) => item.username), ["studioflow"]);
    assert.match(fake.calls[0].url, /platform=instagram/);
    const url = await zernioConnectUrl(KEY, { profileId: "prof1", redirectUrl: "https://app.test/admin?view=marketing&zernio=1" });
    assert.equal(url, "https://www.instagram.com/oauth/authorize?x=1");
    const asked = new URL(fake.calls[1].url);
    assert.equal(asked.pathname, "/api/v1/connect/instagram");
    assert.equal(asked.searchParams.get("profileId"), "prof1");
    assert.equal(asked.searchParams.get("redirect_url"), "https://app.test/admin?view=marketing&zernio=1");
  } finally {
    fake.restore();
  }
});

test("zernio: métricas do post e espera enquanto sincroniza", async () => {
  const fake = mockFetch([
    { status: 202, body: { message: "sync pending" } },
    { status: 200, body: { analytics: { views: 1500, reach: 900, likes: 80, comments: 6, saves: 21, shares: 9, impressions: 1700 } } },
  ]);
  try {
    assert.equal(await zernioMetrics(KEY, "p1"), null);
    assert.deepEqual(await zernioMetrics(KEY, "p1"), { views: 1500, reach: 900, likes: 80, comments: 6, saves: 21, shares: 9 });
  } finally {
    fake.restore();
  }
});
