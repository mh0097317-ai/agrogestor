import test from "node:test";
import assert from "node:assert/strict";
import {
  downloadGoogleVideo,
  getGoogleVideoOperation,
  isVideoOperationName,
  startGoogleVideo,
  validateGoogleVideoKey,
} from "../src/services/marketing/video-generation";

test("video generation only polls a Veo operation name returned by Google", () => {
  assert.equal(
    isVideoOperationName(
      "models/veo-3.1-generate-preview/operations/abcd1234_efgh",
    ),
    true,
  );
  assert.equal(isVideoOperationName("https://attacker.test/anything"), false);
  assert.equal(
    isVideoOperationName("models/other-model/operations/abcd1234"),
    false,
  );
});

test("Google video key validation uses a read-only model lookup and preserves provider privacy", async () => {
  let requested = "";
  await validateGoogleVideoKey("google-test-key", async (input, init) => {
    requested = String(input);
    assert.equal(
      new Headers(init?.headers).get("x-goog-api-key"),
      "google-test-key",
    );
    return new Response("{}", { status: 200 });
  });
  assert.match(requested, /models\/veo-3\.1-generate-preview$/);
  await assert.rejects(
    validateGoogleVideoKey(
      "google-test-key",
      async () => new Response("provider-secret", { status: 401 }),
    ),
    (error: unknown) =>
      error instanceof Error &&
      /Google recusou/.test(error.message) &&
      !error.message.includes("provider-secret"),
  );
});

test("Veo request stores the requested social aspect ratio and only starts one paid render", async () => {
  const payloads: string[] = [];
  const operation = await startGoogleVideo(
    {
      key: "secret-key",
      prompt: "A polished vertical barbershop promo.",
      aspectRatio: "9:16",
      resolution: "720p",
    },
    async (_input, init) => {
      payloads.push(String(init?.body));
      return Response.json({
        name: "models/veo-3.1-generate-preview/operations/abcd1234",
      });
    },
  );
  assert.equal(
    operation,
    "models/veo-3.1-generate-preview/operations/abcd1234",
  );
  assert.deepEqual(
    (JSON.parse(payloads[0]) as { parameters: unknown }).parameters,
    { aspectRatio: "9:16", resolution: "720p", sampleCount: 1 },
  );
});

test("completed Veo operations return the generated file and download only from Google's host", async () => {
  const result = await getGoogleVideoOperation(
    "secret-key",
    "models/veo-3.1-generate-preview/operations/abcd1234",
    async () =>
      Response.json({
        done: true,
        response: {
          generateVideoResponse: {
            generatedSamples: [
              {
                video: {
                  uri: "https://generativelanguage.googleapis.com/v1beta/files/video",
                },
              },
            ],
          },
        },
      }),
  );
  assert.equal(result.done, true);
  assert.equal(
    result.videoUri,
    "https://generativelanguage.googleapis.com/v1beta/files/video",
  );

  const bytes = await downloadGoogleVideo(
    "secret-key",
    result.videoUri!,
    async (_input, init) => {
      assert.equal(
        new Headers(init?.headers).get("x-goog-api-key"),
        "secret-key",
      );
      return new Response(new Uint8Array([0, 0, 0, 1]));
    },
  );
  assert.deepEqual([...bytes], [0, 0, 0, 1]);
  await assert.rejects(
    downloadGoogleVideo(
      "secret-key",
      "https://attacker.test/video.mp4",
      async () => new Response(""),
    ),
    /endereço de vídeo inválido/,
  );
});
