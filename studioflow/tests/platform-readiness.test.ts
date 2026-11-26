import test from "node:test";
import assert from "node:assert/strict";
import { readinessFromEnv } from "../src/lib/platform-readiness";

const extra = { evolution: true, aiVaultKeys: 1, outboundMode: "live" };

test("prontidão aponta o que falta sem expor valores", () => {
  const items = readinessFromEnv({ NARRATION_TOKEN: "x", RESEND_API_KEY: "re_x" }, extra);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(byId["cron-secret"].ok, false);
  assert.equal(byId["asaas-platform"].ok, false);
  assert.equal(byId["email"].ok, true);
  assert.equal(byId["leftover-narration"].ok, false);
  assert.equal(byId["leaked-passwords"].manual, true);
  assert.ok(!JSON.stringify(items).includes("re_x"));
});

test("preview enviando de verdade é sinalizado", () => {
  const items = readinessFromEnv({ VERCEL_ENV: "preview" }, extra);
  assert.equal(items.find((i) => i.id === "outbound-mode")?.ok, false);
  const safe = readinessFromEnv({ VERCEL_ENV: "preview" }, { ...extra, outboundMode: "sandbox" });
  assert.equal(safe.find((i) => i.id === "outbound-mode")?.ok, true);
});
