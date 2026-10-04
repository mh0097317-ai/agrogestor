import test from "node:test";
import assert from "node:assert/strict";
import { inboundInstagram } from "../src/services/assistant/instagram";
import { inboundMessages } from "../src/services/assistant/whatsapp";
import { audioPlaceholder, audioText, transcribe } from "../src/services/assistant/transcribe";

test("instagram: lê o Direct, ignora ecos da própria conta e marca áudios", () => {
  const body = {
    object: "instagram",
    entry: [
      {
        id: "17841400000000000",
        messaging: [
          { sender: { id: "900001" }, recipient: { id: "17841400000000000" }, message: { mid: "m1", text: "Tem horário amanhã?" } },
          { sender: { id: "17841400000000000" }, recipient: { id: "900001" }, message: { mid: "m2", text: "Tem sim!", is_echo: true } },
          { sender: { id: "900002" }, recipient: { id: "17841400000000000" }, message: { mid: "m3", attachments: [{ type: "audio", payload: { url: "https://cdn.example/a.mp4" } }] } },
          { sender: { id: "900003" }, recipient: { id: "17841400000000000" }, read: { mid: "m1" } },
        ],
      },
    ],
  };
  const found = inboundInstagram(body, "17841400000000000");
  assert.equal(found.length, 2);
  assert.deepEqual(found[0], { recipient: "17841400000000000", from: "900001", id: "m1", text: "Tem horário amanhã?" });
  assert.equal(found[1].audioUrl, "https://cdn.example/a.mp4");
  assert.equal(found[1].text, "[O cliente enviou um áudio.]");
  assert.deepEqual(inboundInstagram({ nothing: true }, "1"), []);
});

test("whatsapp: áudio chega com o id da mídia para transcrever", () => {
  const found = inboundMessages({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "123456" },
              contacts: [{ wa_id: "5511987654321", profile: { name: "Ana" } }],
              messages: [{ from: "5511987654321", id: "wamid.A", type: "audio", audio: { id: "media-9", mime_type: "audio/ogg" } }],
            },
          },
        ],
      },
    ],
  });
  assert.equal(found.length, 1);
  assert.equal(found[0].audioId, "media-9");
  assert.equal(found[0].text, "[O cliente enviou um áudio.]");
});

test("transcrição: sem chave, pede texto; com chave, usa o serviço configurado", async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.TRANSCRIBE_API_KEY;
    let loaded = false;
    assert.equal(
      await audioText(async () => {
        loaded = true;
        return { audio: new ArrayBuffer(4), mime: "audio/ogg" };
      }),
      audioPlaceholder,
    );
    assert.equal(loaded, false);

    process.env.TRANSCRIBE_API_KEY = "test-key";
    process.env.TRANSCRIBE_BASE_URL = "https://transcribe.example/v1/";
    let request: { url: string; auth: string | null; model: unknown } | null = null;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const form = init.body as FormData;
      request = {
        url,
        auth: new Headers(init.headers).get("authorization"),
        model: form.get("model"),
      };
      return new Response(JSON.stringify({ text: " Tem horário amanhã às três? " }));
    }) as typeof fetch;
    assert.equal(
      await audioText(async () => ({ audio: new ArrayBuffer(8), mime: "audio/ogg" })),
      "🎤 Tem horário amanhã às três?",
    );
    assert.deepEqual(request, {
      url: "https://transcribe.example/v1/audio/transcriptions",
      auth: "Bearer test-key",
      model: "whisper-1",
    });
    // A failure never breaks the conversation: the customer is asked to write.
    globalThis.fetch = (async () => new Response("no", { status: 500 })) as typeof fetch;
    assert.equal(
      await audioText(async () => ({ audio: new ArrayBuffer(8), mime: "audio/ogg" })),
      audioPlaceholder,
    );
    await assert.rejects(transcribe(new ArrayBuffer(17 * 1024 * 1024), "audio/ogg"), /too large/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = previous;
  }
});
