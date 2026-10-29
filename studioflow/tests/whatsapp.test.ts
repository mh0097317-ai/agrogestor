import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  brazilPhone,
  inboundMessages,
  sendWhatsApp,
  sendWhatsAppAudio,
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
                {
                  from: "5511987654321",
                  id: "wamid.1",
                  type: "text",
                  text: { body: "Oi, tem horário?" },
                },
                {
                  from: "5511987654321",
                  id: "wamid.2",
                  type: "audio",
                  audio: {},
                },
                {
                  from: "5511987654321",
                  id: "wamid.3",
                  type: "image",
                  image: { id: "media-3", caption: "Quero esse corte" },
                },
              ],
            },
          },
          {
            value: {
              metadata: { phone_number_id: "1234567" },
              statuses: [{ id: "x" }],
            },
          },
        ],
      },
    ],
  };
  const messages = inboundMessages(payload);
  assert.equal(messages.length, 3);
  assert.deepEqual(messages[0], {
    phoneNumberId: "1234567",
    from: "5511987654321",
    name: "Ana",
    id: "wamid.1",
    text: "Oi, tem horário?",
  });
  assert.match(messages[1].text, /áudio/);
  assert.equal(messages[2].imageId, "media-3");
  assert.match(messages[2].text, /Quero esse corte/);
  const selectedButton = inboundMessages({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "1234567" },
              messages: [
                {
                  from: "5511987654321",
                  id: "wamid.button",
                  type: "interactive",
                  interactive: {
                    type: "button_reply",
                    button_reply: { id: "slot-09", title: "09:00" },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  assert.equal(selectedButton[0].text, "slot-09");
  assert.deepEqual(inboundMessages({}), []);
  assert.deepEqual(inboundMessages(null), []);
});

test("WhatsApp sends up to three time options as reply buttons and longer menus as lists", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; body: unknown }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body;
    requests.push({
      url,
      body: typeof body === "string" ? JSON.parse(body) : (body as FormData),
    });
    if (url.endsWith("/media")) return Response.json({ id: "media-voice" });
    return Response.json({ messages: [{ id: `sent-${requests.length}` }] });
  };
  try {
    const options = ["09:00", "09:30", "10:00", "10:30"].map((time) => ({
      id: `slot-${time}`,
      title: time,
      description: "Matheus · segunda-feira",
    }));
    await sendWhatsApp({
      phoneNumberId: "phone-id",
      token: "secret",
      to: "5562999999999",
      body: "Qual horário fica melhor para você?",
      menu: {
        title: "Horários",
        button: "Ver horários",
        rows: options.slice(0, 3),
      },
    });
    const quickReply = requests[0].body as {
      interactive: {
        type: string;
        action: { buttons: { reply: { id: string } }[] };
      };
    };
    assert.equal(quickReply.interactive.type, "button");
    assert.deepEqual(
      quickReply.interactive.action.buttons.map((button) => button.reply.id),
      ["slot-09:00", "slot-09:30", "slot-10:00"],
    );

    await sendWhatsApp({
      phoneNumberId: "phone-id",
      token: "secret",
      to: "5562999999999",
      body: "Tenho mais horários disponíveis.",
      menu: { title: "Horários", button: "Ver horários", rows: options },
    });
    const longerMenu = requests[1].body as {
      interactive: {
        type: string;
        action: { sections: { rows: unknown[] }[] };
      };
    };
    assert.equal(longerMenu.interactive.type, "list");
    assert.equal(longerMenu.interactive.action.sections[0].rows.length, 4);

    await sendWhatsApp({
      phoneNumberId: "phone-id",
      token: "secret",
      to: "5562999999999",
      body: "Boa noite! Como posso ajudar?",
      menu: {
        title: "Como posso ajudar?",
        button: "Ver opções",
        forceList: true,
        rows: options.slice(0, 3),
      },
    });
    const welcomeMenu = requests[2].body as {
      interactive: {
        type: string;
        action: { sections: { rows: unknown[] }[] };
      };
    };
    assert.equal(welcomeMenu.interactive.type, "list");
    assert.equal(welcomeMenu.interactive.action.sections[0].rows.length, 3);

    await sendWhatsAppAudio({
      phoneNumberId: "phone-id",
      token: "secret",
      to: "5562999999999",
      audio: new Uint8Array([1, 2, 3]),
    });
    const form = requests[3].body as FormData;
    assert.equal(form.get("messaging_product"), "whatsapp");
    assert.equal(form.get("type"), "audio/mpeg");
    const audioMessage = requests[4].body as {
      type: string;
      audio: { id: string };
    };
    assert.equal(audioMessage.type, "audio");
    assert.equal(audioMessage.audio.id, "media-voice");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
