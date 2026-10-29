import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  createInstance,
  setWebhook,
  connectInstance,
  instanceState,
  instanceOwner,
  sendText,
  sendBookingMenu,
  sendWhatsAppAudio,
  parseEvolution,
  evolutionAudio,
  findContacts,
} from "../src/services/whatsapp/evolution";

test("Evolution audio decodes inline bytes, preserves MIME, and rejects oversized media before decoding", async () => {
  const audio = await evolutionAudio(
    "tenant-instance",
    "real-message-id",
    "data:audio/ogg;base64,AAEC",
    "audio/ogg; codecs=opus",
  );
  assert.deepEqual([...new Uint8Array(audio.audio)], [0, 1, 2]);
  assert.equal(audio.mime, "audio/ogg");
  await assert.rejects(
    evolutionAudio("tenant-instance", "id", "!invalid!"),
    /audio-unavailable/,
  );
  await assert.rejects(
    evolutionAudio("tenant-instance", "id", "A".repeat(23 * 1024 * 1024)),
    /audio-unavailable/,
  );
});

test("Evolution HTTP contract: tenant instance, enabled signed webhook, QR, owner, status and text", async () => {
  const seen: {
    path: string;
    body: Record<string, unknown>;
    key: string | undefined;
  }[] = [];
  let rawQr = false;
  let multipleOwners = false;
  let rejectSend = false;
  let invalidContacts = false;
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    seen.push({
      path: req.url || "",
      body: body ? JSON.parse(body) : {},
      key: req.headers.apikey as string | undefined,
    });
    res.setHeader("content-type", "application/json");
    if (req.url?.startsWith("/chat/findContacts/")) {
      res.end(
        JSON.stringify(
          invalidContacts
            ? {}
            : [{ remoteJid: "5511998765432@s.whatsapp.net", pushName: "Ana" }],
        ),
      );
      return;
    }
    if (rejectSend && req.url?.startsWith("/message/sendText")) {
      res.statusCode = 500;
      res.end(JSON.stringify({ message: "test-key test-webhook-token" }));
      return;
    }
    if (req.url?.startsWith("/message/sendWhatsAppAudio/")) {
      res.end(JSON.stringify({ key: { id: "audio-sent" } }));
      return;
    }
    if (req.url?.startsWith("/message/sendList/")) {
      res.end(JSON.stringify({ key: { id: "list-sent" } }));
      return;
    }
    res.end(
      JSON.stringify(
        req.url?.startsWith("/instance/connect/")
          ? rawQr
            ? { code: "test-local-qr-only" }
            : { base64: "data:image/png;base64,AAAA" }
          : req.url?.startsWith("/instance/connectionState/")
            ? { instance: { state: "open" } }
            : req.url?.startsWith("/instance/fetchInstances")
              ? multipleOwners
                ? [
                    {
                      name: "sf-other",
                      ownerJid: "5511999999999@s.whatsapp.net",
                      profileName: "Other",
                    },
                    {
                      name: "sf-one",
                      ownerJid: "5511987654321@s.whatsapp.net",
                      profileName: "Loja",
                    },
                  ]
                : [
                    {
                      ownerJid: "5511987654321@s.whatsapp.net",
                      profileName: "Loja",
                    },
                  ]
              : {},
      ),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const originalUrl = process.env.EVOLUTION_API_URL,
    originalKey = process.env.EVOLUTION_API_KEY,
    originalNativeLists = process.env.STUDIOFLOW_WHATSAPP_NATIVE_LISTS;
  process.env.EVOLUTION_API_URL = `http://127.0.0.1:${port}`;
  process.env.EVOLUTION_API_KEY = "test-key";
  delete process.env.STUDIOFLOW_WHATSAPP_NATIVE_LISTS;
  try {
    await createInstance(
      "sf-one",
      "https://app.test/api/evolution/one",
      "test-webhook-token",
    );
    await setWebhook(
      "sf-one",
      "https://app.test/api/evolution/one",
      "test-webhook-token",
    );
    assert.equal((seen[0].body.webhook as { enabled: boolean }).enabled, true);
    assert.deepEqual((seen[0].body.webhook as { headers: unknown }).headers, {
      "x-studioflow-webhook-token": "test-webhook-token",
    });
    assert.equal(seen[0].body.instanceName, "sf-one");
    assert.equal(seen[0].body.groupsIgnore, true);
    assert.equal(
      (await connectInstance("sf-one")).qr,
      "data:image/png;base64,AAAA",
    );
    assert.equal(await instanceState("sf-one"), "open");
    assert.deepEqual(await instanceOwner("sf-one"), {
      phone: "5511987654321",
      name: "Loja",
    });
    rawQr = true;
    assert.match(
      (await connectInstance("sf-one")).qr,
      /^data:image\/png;base64,/,
    );
    multipleOwners = true;
    assert.equal((await instanceOwner("sf-one")).phone, "5511987654321");
    assert.equal((await instanceOwner("sf-unknown")).phone, "");
    await sendText("sf-one", "5511987654321", "Confirmado");
    assert.deepEqual(seen.at(-1)?.body, {
      number: "5511987654321",
      text: "Confirmado",
    });
    await sendBookingMenu("sf-one", "5511987654321", "Boa noite!", {
      title: "Como posso ajudar?",
      button: "Ver opções",
      forceList: true,
      rows: [
        {
          id: "Quero agendar um horário",
          title: "Agendar horário",
          description: "Escolher serviço e horário",
        },
        {
          id: "Quero ver serviços e preços",
          title: "Serviços e preços",
          description: "Consultar catálogo",
        },
        {
          id: "Quero falar com a equipe",
          title: "Falar com a equipe",
          description: "Pedir ajuda de uma pessoa",
        },
      ],
    });
    assert.equal(seen.at(-1)?.path, "/message/sendList/sf-one");
    assert.equal(seen.at(-1)?.body.buttonText, "Ver opções");
    assert.equal(
      (seen.at(-1)?.body.sections as { rows: unknown[] }[])[0].rows.length,
      3,
    );
    assert.ok(seen.every((req) => req.key === "test-key"));
    await sendWhatsAppAudio(
      "sf-one",
      "5511987654321",
      new Uint8Array([1, 2, 3]),
    );
    assert.equal(seen.at(-1)?.path, "/message/sendWhatsAppAudio/sf-one");
    assert.equal(seen.at(-1)?.body.number, "5511987654321");
    assert.equal(seen.at(-1)?.body.audio, "AQID");
    assert.equal((await findContacts("sf-one", 2)).length, 1);
    assert.equal(seen.at(-1)?.path, "/chat/findContacts/sf-one");
    assert.deepEqual(seen.at(-1)?.body, { where: {}, offset: 500, page: 2 });
    invalidContacts = true;
    await assert.rejects(findContacts("sf-one"), /lista de contatos inválida/);
    rejectSend = true;
    await assert.rejects(
      sendText("sf-one", "5511987654321", "test"),
      (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /HTTP 500/);
        assert.ok(!error.message.includes("test-key"));
        assert.ok(!error.message.includes("test-webhook-token"));
        return true;
      },
    );
    assert.equal(
      parseEvolution({
        event: "MESSAGES_UPSERT",
        instance: "sf-one",
        data: {
          key: {
            id: "group",
            remoteJid: "123@g.us",
            remoteJidAlt: "5511987654321@s.whatsapp.net",
          },
          message: { conversation: "ignored" },
        },
      }).messages.length,
      0,
    );
  } finally {
    if (originalUrl === undefined) delete process.env.EVOLUTION_API_URL;
    else process.env.EVOLUTION_API_URL = originalUrl;
    if (originalKey === undefined) delete process.env.EVOLUTION_API_KEY;
    else process.env.EVOLUTION_API_KEY = originalKey;
    if (originalNativeLists === undefined)
      delete process.env.STUDIOFLOW_WHATSAPP_NATIVE_LISTS;
    else process.env.STUDIOFLOW_WHATSAPP_NATIVE_LISTS = originalNativeLists;
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
