import assert from "node:assert/strict";
import makeMethod from "/tmp/studioflow-native-method.cjs";

(async () => {
  const R = await import("/evolution/node_modules/baileys/lib/index.js");
  const method = makeMethod(R, { isArray: Array.isArray });
  let lists = 0,
    texts = 0;
  const context = {
    instance: { wuid: "5511999999999@s.whatsapp.net" },
    client: {
      async relayMessage(jid, message, options) {
        lists++;
        assert.equal(jid, "5511888888888@s.whatsapp.net");
        assert.equal(message.listMessage.listType, 1);
        assert.equal(
          message.listMessage.sections[0].rows[0].rowId,
          "Consultar horarios",
        );
        assert.ok(options.messageId);
        assert.deepEqual(options.additionalNodes, [
          {
            tag: "biz",
            attrs: {},
            content: [{ tag: "list", attrs: { type: "product_list", v: "2" } }],
          },
        ]);
        const encoded = R.proto.Message.encode(message).finish();
        assert.ok(encoded.length > 0);
        assert.equal(R.proto.Message.decode(encoded).listMessage.listType, 1);
        return options.messageId;
      },
      async sendMessage(jid, content) {
        texts++;
        assert.equal(content.text, "Texto normal preservado");
        return { key: { id: "test-text" } };
      },
    },
  };
  const message = await method.call(context, "5511888888888@s.whatsapp.net", {
    listMessage: {
      title: "Teste offline",
      description: "Escolha uma opcao",
      buttonText: "Ver horarios",
      listType: 2,
      sections: [
        {
          title: "Horarios",
          rows: [{ title: "09:00", rowId: "Consultar horarios" }],
        },
      ],
    },
  });
  assert.ok(message.key.id);
  assert.equal(lists, 1);
  assert.equal(texts, 0);
  await method.call(context, "5511888888888@s.whatsapp.net", {
    conversation: "Texto normal preservado",
  });
  assert.equal(texts, 1);
  assert.equal(lists, 1);
  console.log(
    "PASS: list encoding, selection IDs, stanza and ordinary text; zero external sends",
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
