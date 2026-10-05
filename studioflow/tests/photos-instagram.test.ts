import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { servicePhotos } from "../src/lib/service-photos";
import { mutateStore } from "../src/services/server-store";
import { businessSchema } from "../src/services/server-validation";
import { fetchInstagramFeed } from "../src/services/instagram-feed";

test("fotos do serviço: principal primeiro, sem repetir, no máximo 3", () => {
  assert.deepEqual(servicePhotos({ image: "/a.jpg", photos: ["/b.jpg", "/a.jpg", "/c.jpg"] }), [
    "/a.jpg",
    "/b.jpg",
    "/c.jpg",
  ]);
  assert.deepEqual(servicePhotos({ image: "", photos: ["/b.jpg"] }), ["/b.jpg"]);
  assert.deepEqual(servicePhotos({ image: "" }), []);
});

test("fotos do serviço: sem a principal, a próxima assume; mais de 3 é recusado", () => {
  const store = createSeed();
  const service = store.services[1];
  mutateStore(store, {
    entity: "services",
    action: "update",
    data: { ...service, image: "", photos: ["/demo/work-2.jpg", "/demo/work-3.jpg"] },
  });
  const saved = store.services.find((item) => item.id === service.id)!;
  assert.equal(saved.image, "/demo/work-2.jpg");
  assert.deepEqual(saved.photos, ["/demo/work-3.jpg"]);
  assert.throws(() =>
    mutateStore(store, {
      entity: "services",
      action: "update",
      data: { ...service, photos: ["/1.jpg", "/2.jpg", "/3.jpg"] },
    }),
  );
});

test("link do Google Maps: só endereços do Google", () => {
  const business = createSeed().business;
  const parse = (mapsUrl: string) => businessSchema.safeParse({ ...business, mapsUrl });
  assert.equal(parse("https://maps.app.goo.gl/AbC123").success, true);
  assert.equal(parse("https://www.google.com/maps/place/Barbearia/@-23.5,-46.6,17z").success, true);
  assert.equal(parse("").success, true);
  assert.equal(parse("https://evil.example/maps").success, false);
  assert.equal(parse("javascript:alert(1)").success, false);
  assert.equal(parse("http://maps.app.goo.gl/AbC").success, false);
});

test("Instagram: perfil e posts recentes, vídeo pela capa, só links seguros", async () => {
  const original = globalThis.fetch;
  const asked: string[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    asked.push(`${url} ${(init?.headers as Record<string, string>)?.Authorization}`);
    const body = String(url).includes("/me/media")
      ? {
          data: [
            {
              id: "1",
              media_type: "IMAGE",
              media_url: "https://cdn.test/1.jpg",
              permalink: "https://www.instagram.com/p/1/",
              caption: "Degradê navalhado ".repeat(20),
            },
            {
              id: "2",
              media_type: "VIDEO",
              media_url: "https://cdn.test/2.mp4",
              thumbnail_url: "https://cdn.test/2.jpg",
              permalink: "https://www.instagram.com/reel/2/",
            },
            { id: "3", media_type: "CAROUSEL_ALBUM", media_url: "http://inseguro/3.jpg", permalink: "https://www.instagram.com/p/3/" },
          ],
        }
      : {
          username: "casa",
          name: "Casa",
          profile_picture_url: "https://cdn.test/me.jpg",
          followers_count: 12800,
          media_count: 340,
        };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  try {
    const feed = await fetchInstagramFeed("token-de-teste");
    assert.equal(feed.connected, true);
    assert.equal(feed.username, "casa");
    assert.equal(feed.followers, 12800);
    assert.deepEqual(
      feed.posts.map((post) => [post.id, post.type, post.image]),
      [
        ["1", "image", "https://cdn.test/1.jpg"],
        ["2", "video", "https://cdn.test/2.jpg"],
      ],
    );
    assert.ok(feed.posts[0].caption.length <= 140);
    // The token travels only in the header, never in the URL.
    assert.ok(asked.every((line) => !line.split(" ")[0].includes("token-de-teste")));
    assert.ok(asked.every((line) => line.endsWith("Bearer token-de-teste")));
  } finally {
    globalThis.fetch = original;
  }
});

test("token do Instagram: avisa quando colam o código errado", async () => {
  const { instagramTokenProblem } = await import("../src/services/assistant/instagram");
  assert.match(instagramTokenProblem("EAAGm0PX4ZCpsBAKZB...")!, /Facebook/);
  assert.match(instagramTokenProblem("0123456789abcdef0123456789abcdef")!, /chave secreta/);
  assert.match(instagramTokenProblem("1234567890123")!, /ID do app/);
  assert.equal(instagramTokenProblem("IGAAKx" + "a".repeat(150)), null);
});
