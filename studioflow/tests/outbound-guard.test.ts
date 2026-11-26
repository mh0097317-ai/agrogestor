import test from "node:test";
import assert from "node:assert/strict";
import {
  assertOutboundAllowed,
  assertPaymentAllowed,
  outboundMode,
} from "../src/services/outbound-guard";

test("produção envia; preview e staging ficam em homologação por padrão", () => {
  assert.equal(outboundMode({ NODE_ENV: "production" }), "live");
  assert.equal(outboundMode({ VERCEL_ENV: "production" }), "live");
  assert.equal(outboundMode({ VERCEL_ENV: "preview" }), "sandbox");
  assert.equal(outboundMode({ STUDIOFLOW_STAGING: "1" }), "sandbox");
  assert.equal(
    outboundMode({ VERCEL_ENV: "preview", STUDIOFLOW_OUTBOUND_MODE: "off" }),
    "off",
  );
});

test("homologação só envia para a lista de teste", () => {
  const env = {
    STUDIOFLOW_STAGING: "1",
    STUDIOFLOW_OUTBOUND_ALLOWLIST: "5562999990000, teste@exemplo.com",
  };
  assert.doesNotThrow(() => assertOutboundAllowed("whatsapp", "62999990000", env));
  assert.doesNotThrow(() => assertOutboundAllowed("email", "Teste@Exemplo.com", env));
  assert.throws(
    () => assertOutboundAllowed("whatsapp", "62988887777", env),
    /bloqueado no modo de homologação/,
  );
  assert.throws(() =>
    assertOutboundAllowed("whatsapp", "62999990000", {
      STUDIOFLOW_OUTBOUND_MODE: "off",
      STUDIOFLOW_OUTBOUND_ALLOWLIST: "62999990000",
    }),
  );
  assert.doesNotThrow(() => assertOutboundAllowed("whatsapp", "1", { VERCEL_ENV: "production" }));
});

test("cobrança real bloqueada fora de produção; sandbox do Asaas e leituras liberadas", () => {
  const env = { STUDIOFLOW_STAGING: "1" };
  assert.throws(() => assertPaymentAllowed("production", "POST", env));
  assert.doesNotThrow(() => assertPaymentAllowed("production", "GET", env));
  assert.doesNotThrow(() => assertPaymentAllowed("sandbox", "POST", env));
  assert.doesNotThrow(() => assertPaymentAllowed("production", "POST", {}));
});
