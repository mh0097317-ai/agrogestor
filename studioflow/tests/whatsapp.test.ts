import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  brazilPhone,
  inboundMessages,
  validSignature,
} from "../src/services/assistant/whatsapp";

test("WhatsApp: assinatura da Meta, mensagens recebidas e número brasileiro", () => {
  const raw = JSON.stringify({ hello: "world" });
  const secret = "segredo-do-app";
  const good = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  assert.equal(validSignature(raw, good, secret), true);
  assert.equal(validSignature(`${raw} `, good, secret), false);
  assert.equal(validSignature(raw, good, "outro"), false);
  assert.equal(validSignature(raw, null, secret), false);
  assert.equal(validSignature(raw, "sha256=abc", secret), false);

  assert.equal(brazilPhone("5511987654321"), "11987654321");
  // Older mobile ids come without the 9 after the area code.
  assert.equal(brazilPhone("551187654321"), "11987654321");
  // Landlines stay as they are.
  assert.equal(brazilPhone("551133334444"), "1133334444");

  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "1234567" },
              contacts: [{ wa_id: "5511987654321", profile: { name: "Ana" } }],
              messages: [
                { from: "5511987654321", id: "wamid.1", type: "text", text: { body: "Oi, tem horário?" } },
                { from: "5511987654321", id: "wamid.2", type: "audio", audio: {} },
              ],
            },
          },
          { value: { metadata: { phone_number_id: "1234567" }, statuses: [{ id: "x" }] } },
        ],
      },
    ],
  };
  const messages = inboundMessages(payload);
  assert.equal(messages.length, 2);
  assert.deepEqual(messages[0], {
    phoneNumberId: "1234567",
    from: "5511987654321",
    name: "Ana",
    id: "wamid.1",
    text: "Oi, tem horário?",
  });
  assert.match(messages[1].text, /áudio/);
  assert.deepEqual(inboundMessages({}), []);
  assert.deepEqual(inboundMessages(null), []);
});
