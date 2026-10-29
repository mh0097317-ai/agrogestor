import test from "node:test";
import assert from "node:assert/strict";
import { openAiCreate } from "../src/services/assistant/provider";
import { understandImage } from "../src/services/assistant/vision";

test("image understanding sends the actual photo to the configured vision provider", async () => {
  const original = globalThis.fetch;
  let request: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({
      id: "vision-test",
      choices: [{ message: { content: "A foto mostra um corte degradê." } }],
      usage: { prompt_tokens: 86, completion_tokens: 12 },
    });
  };
  try {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const result = await understandImage(
      openAiCreate("test-key", "gpt-4o-mini"),
      {
        image: bytes.buffer,
        mime: "image/jpeg",
      },
      "Quero esse corte",
    );
    const messages = request?.messages as Record<string, unknown>[];
    const userContent = messages[1].content as Record<string, unknown>[];
    assert.equal(
      result.text,
      "[Descrição visual da foto do cliente: A foto mostra um corte degradê.]\nLegenda enviada pelo cliente: Quero esse corte",
    );
    assert.deepEqual(result.usage, { input: 86, output: 12 });
    assert.match(String(userContent[0].text), /Quero esse corte/);
    assert.deepEqual(userContent[1], {
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`,
        detail: "high",
      },
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("image understanding rejects unsupported types before calling a provider", async () => {
  let called = false;
  await assert.rejects(
    understandImage(
      async () => {
        called = true;
        throw new Error("must not call provider");
      },
      { image: new Uint8Array([1]).buffer, mime: "application/pdf" },
    ),
    /unsupported-image/,
  );
  assert.equal(called, false);
});
