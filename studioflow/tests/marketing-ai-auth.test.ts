import test from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import {
  aiFailure,
  validateMarketingAiKey,
  clientFor,
  marketingAiConfigured,
} from "../src/services/marketing/ai";

function providerError(status: number) {
  return new Anthropic.APIError(
    status,
    { message: "private-provider-detail" },
    "private-provider-detail",
    new Headers(),
  );
}
test("marketing reports invalid credentials without exposing provider details", () => {
  assert.throws(
    () => aiFailure(providerError(401)),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /chave do Marketing/);
      assert.doesNotMatch(e.message, /private-provider-detail/);
      return true;
    },
  );
  assert.throws(() => aiFailure(providerError(403)), /permissão/);
  assert.throws(() => aiFailure(providerError(404)), /modelo escolhido/);
});

test("marketing does not borrow unrelated credentials and reports actionable provider failures", () => {
  const saved = process.env.STUDIOFLOW_MARKETING_ANTHROPIC_KEY;
  const generic = process.env.ANTHROPIC_API_KEY;
  try {
    delete process.env.STUDIOFLOW_MARKETING_ANTHROPIC_KEY;
    process.env.ANTHROPIC_API_KEY = "unrelated-test-key";
    assert.equal(marketingAiConfigured(), false);
    assert.throws(() => clientFor(), /Marketing → Chave da IA/);
    assert.throws(
      () =>
        aiFailure(
          new Anthropic.APIError(
            400,
            { message: "credit balance is too low" },
            "credit balance is too low",
            new Headers(),
          ),
        ),
      /sem saldo/,
    );
    assert.throws(() => aiFailure(providerError(500)), /indisponível/);
    assert.throws(
      () => aiFailure(new Anthropic.APIConnectionTimeoutError()),
      /demorou/,
    );
  } finally {
    if (saved === undefined)
      delete process.env.STUDIOFLOW_MARKETING_ANTHROPIC_KEY;
    else process.env.STUDIOFLOW_MARKETING_ANTHROPIC_KEY = saved;
    if (generic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = generic;
  }
});
test("marketing key validation propagates rejection and fails safely on network failure", async () => {
  let checked = false;
  await validateMarketingAiKey("test-value", async (key) => {
    assert.equal(key, "test-value");
    checked = true;
  });
  assert.equal(checked, true);
  await assert.rejects(
    validateMarketingAiKey("test-value", async () => {
      throw providerError(401);
    }),
    /chave do Marketing/,
  );
  await assert.rejects(
    validateMarketingAiKey("test-value", async () => {
      throw Error("private-network-detail");
    }),
    /chave anterior foi preservada/,
  );
});
