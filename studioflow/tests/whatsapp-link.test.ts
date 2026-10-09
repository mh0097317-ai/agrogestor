import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import {
  jidPhone,
  normalState,
  parseEvolution,
} from "../src/services/whatsapp/evolution";
import { withCountry } from "../src/services/whatsapp/link";
import { professionalMessage } from "../src/services/whatsapp/notify";
import { runTool, systemPrompt } from "../src/services/assistant/agent";

test("Evolution: só texto e áudio de clientes, sem grupos nem mensagens da loja", () => {
  const delivery = parseEvolution({
    event: "messages.upsert",
    instance: "sf-abc",
    data: [
      {
        key: {
          remoteJid: "5511987654321@s.whatsapp.net",
          fromMe: false,
          id: "A1",
        },
        pushName: "Ana",
        message: { conversation: "Oi, tem horário hoje?" },
      },
      {
        key: {
          remoteJid: "5511987654321@s.whatsapp.net",
          fromMe: true,
          id: "A2",
        },
        message: { conversation: "resposta da loja" },
      },
      {
        key: { remoteJid: "120363000000@g.us", fromMe: false, id: "A3" },
        message: { conversation: "grupo" },
      },
      {
        key: {
          remoteJid: "9999@lid",
          remoteJidAlt: "5521912345678@s.whatsapp.net",
          fromMe: false,
          id: "A4",
        },
        pushName: "Bia",
        message: { extendedTextMessage: { text: "Quanto é a barba?" } },
      },
      {
        key: {
          remoteJid: "5511911112222@s.whatsapp.net",
          fromMe: false,
          id: "A5",
        },
        message: {
          audioMessage: { mimetype: "audio/ogg; codecs=opus" },
          base64: "AAAA",
        },
      },
      {
        key: {
          remoteJid: "5511933334444@s.whatsapp.net",
          fromMe: false,
          id: "A6",
        },
        message: { audioMessage: {} },
      },
    ],
  });
  assert.equal(delivery.instance, "sf-abc");
  assert.deepEqual(
    delivery.messages.map((message) => [
      message.id,
      message.from,
      message.text,
    ]),
    [
      ["A1", "5511987654321", "Oi, tem horário hoje?"],
      ["A4", "5521912345678", "Quanto é a barba?"],
      ["A5", "5511911112222", ""],
      ["A6", "5511933334444", "[O cliente enviou um áudio.]"],
    ],
  );
  assert.deepEqual(delivery.messages[2].audio, {
    base64: "AAAA",
    mime: "audio/ogg",
  });
  assert.equal(
    parseEvolution({ event: "CONNECTION_UPDATE", data: { state: "open" } })
      .state,
    "open",
  );
  assert.equal(normalState("refused"), "close");
  assert.equal(jidPhone("123@g.us"), "");
  assert.equal(withCountry("11987654321"), "5511987654321");
  assert.equal(withCountry("5511987654321"), "5511987654321");
});

test("aviso ao profissional: quem, quando, o quê e o contato, sem linhas soltas", () => {
  const store = createSeed();
  const appointment = {
    ...store.appointments[0],
    depositStatus: null,
    membershipId: null,
  };
  const professional = store.professionals.find(
    (person) => person.id === appointment.professionalId,
  )!;
  const text = professionalMessage(store, appointment, "https://app.test");
  assert.match(text, new RegExp(`^Oi, ${professional.name.split(" ")[0]}!`));
  assert.ok(text.includes(`*${appointment.customerName}*`));
  assert.ok(text.includes(store.business.name));
  assert.match(
    text,
    /https:\/\/app\.test\/dashboard\/agenda\?date=\d{4}-\d{2}-\d{2}/,
  );
  assert.ok(!text.includes("\n\n\n"));
  const pending = professionalMessage(
    store,
    { ...appointment, depositStatus: "pending" },
    "https://app.test",
  );
  assert.match(pending, /Aguardando o sinal no Pix/);
});

test("recepcionista: link de agendamento já com o serviço e o profissional", async () => {
  const store = createSeed();
  const service = store.services[0];
  const person = store.professionals[0];
  const ctx = {
    channel: "whatsapp" as const,
    origin: "https://app.test",
    payments: false,
    loadStore: async () => store,
    book: async () => {
      throw new Error("não deve marcar");
    },
  };
  const result = await runTool(
    "link_agendamento",
    { servicos: [service.id, "inexistente"], profissional: person.id },
    ctx,
    {},
  );
  const { link } = JSON.parse(result.content) as { link: string };
  const url = new URL(link);
  assert.equal(url.pathname, `/${store.business.slug}/agendar`);
  assert.equal(url.searchParams.get("service"), service.id);
  assert.equal(url.searchParams.get("professional"), person.id);
  const plain = await runTool(
    "link_agendamento",
    { servicos: [], profissional: "any" },
    ctx,
    {},
  );
  assert.equal(
    JSON.parse(plain.content).link,
    `https://app.test/${store.business.slug}/agendar`,
  );
  store.settings.onlineBookingEnabled = false;
  const disabled = await runTool(
    "link_agendamento",
    { servicos: [], profissional: "any" },
    ctx,
    {},
  );
  assert.equal(disabled.isError, true);
  assert.match(disabled.content, /indisponível/);
  const prompt = systemPrompt(store, false, "whatsapp");
  assert.match(prompt, /agende diretamente na conversa/);
  assert.match(prompt, /link público está DESATIVADO/);
  assert.match(prompt, /Nunca ofereça desconto/);
});
