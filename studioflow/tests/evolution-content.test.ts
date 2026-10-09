import test from "node:test";
import assert from "node:assert/strict";
import { parseEvolution } from "../src/services/whatsapp/evolution";

// Local parser fixtures only; nothing is sent to WhatsApp or production.
function delivery(message: unknown, messageType?: string) {
  return parseEvolution({
    event: "MESSAGES_UPSERT",
    instance: "sf-test",
    data: {
      key: { id: "incoming", remoteJid: "5511987654321@s.whatsapp.net" },
      pushName: "Cliente",
      message,
      messageType,
    },
  }).messages;
}

test("Evolution ignores non-content upserts instead of inventing a file", () => {
  for (const message of [
    undefined,
    null,
    {},
    [],
    { messageContextInfo: { deviceListMetadataVersion: 2 } },
    { protocolMessage: { type: 0, key: { id: "deleted" } } },
    { protocolMessage: { type: 14, editedMessage: { conversation: "edit" } } },
    { editedMessage: { message: { conversation: "edit" } } },
    { reactionMessage: { text: "👍" } },
    { stickerMessage: { mimetype: "image/webp" } },
    { pollUpdateMessage: {} },
    { senderKeyDistributionMessage: {} },
    { unknownMessage: {} },
    { conversation: "  " },
    { extendedTextMessage: { text: {} } },
  ]) {
    assert.deepEqual(delivery(message), [], JSON.stringify(message));
  }
  // A type label without the corresponding content is not proof of a file.
  for (const type of ["imageMessage", "documentMessage", "audioMessage"])
    assert.deepEqual(delivery({}, type), []);
  assert.deepEqual(delivery({ documentMessage: null }), []);
});

test("Evolution keeps text with context metadata and unwraps supported envelopes", () => {
  const text = "Qual o valor do corte?";
  assert.equal(
    delivery({ conversation: text, messageContextInfo: {} })[0].text,
    text,
  );
  for (const wrapper of [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
  ]) {
    assert.equal(
      delivery({ [wrapper]: { message: { extendedTextMessage: { text } } } })[0]
        .text,
      text,
    );
  }
  assert.deepEqual(
    delivery({
      ephemeralMessage: { message: { protocolMessage: { type: 3 } } },
    }),
    [],
  );
  let deeplyWrapped: unknown = { conversation: text };
  for (let i = 0; i < 10; i++)
    deeplyWrapped = { ephemeralMessage: { message: deeplyWrapped } };
  assert.deepEqual(delivery(deeplyWrapped), []);
});

test("Evolution preserves actual photos, documents, videos and captions", () => {
  assert.equal(
    delivery({ imageMessage: { caption: "Quero esse corte" } })[0].text,
    "[O cliente enviou uma foto.]\nQuero esse corte",
  );
  assert.equal(
    delivery({ imageMessage: {} })[0].text,
    "[O cliente enviou uma foto.]",
  );
  for (const type of ["documentMessage", "videoMessage"])
    assert.equal(
      delivery({ [type]: {} })[0].text,
      "[O cliente enviou um arquivo.]",
    );
  assert.equal(
    delivery({
      documentWithCaptionMessage: {
        message: { documentMessage: { caption: "Documento" } },
      },
    })[0].text,
    "[O cliente enviou um arquivo.]\nDocumento",
  );
});

test("Evolution preserves wrapped audio and inline transcription data", () => {
  const audio = delivery({
    ephemeralMessage: {
      message: { audioMessage: { mimetype: "audio/ogg; codecs=opus" } },
    },
    base64: "AAAA",
  })[0];
  assert.equal(audio.text, "");
  assert.deepEqual(audio.audio, { base64: "AAAA", mime: "audio/ogg" });
  assert.equal(
    delivery({ audioMessage: {} })[0].text,
    "[O cliente enviou um áudio.]",
  );
});

test("Evolution accepts a text once in a batch alongside ignored controls", () => {
  const data = (id: string, message: unknown) => ({
    key: { id, remoteJid: "5511987654321@s.whatsapp.net" },
    message,
  });
  const result = parseEvolution({
    event: "messages.upsert",
    data: [
      data("control", { messageContextInfo: {} }),
      data("text", { conversation: "Quanto custa?" }),
      data("reaction", { reactionMessage: { text: "👍" } }),
    ],
  });
  assert.deepEqual(
    result.messages.map((message) => message.id),
    ["text"],
  );
});
