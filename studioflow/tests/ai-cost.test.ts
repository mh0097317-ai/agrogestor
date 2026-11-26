import test from "node:test";
import assert from "node:assert/strict";
import { budgetState, costSummary, monthStart, usageUsd } from "../src/lib/ai-cost";

test("custo por modelo com o preço oficial; modelo desconhecido não é chutado", () => {
  assert.equal(usageUsd({ model: "claude-sonnet-5-5", inputTokens: 1_000_000, outputTokens: 100_000 }), 3);
  assert.equal(usageUsd({ model: "modelo-x", inputTokens: 10, outputTokens: 10 }), null);
  const summary = costSummary(
    [
      { model: "claude-sonnet-5-5", inputTokens: 500_000, outputTokens: 50_000 },
      { model: "claude-haiku-4-5", inputTokens: 1_000_000, outputTokens: 0 },
      { model: "modelo-x", inputTokens: 100, outputTokens: 0 },
    ],
    5.5,
  );
  assert.equal(summary.usd, 2.5);
  assert.equal(summary.brlCents, 1375);
  assert.equal(summary.unpricedTokens, 100);
  assert.equal(costSummary([], null).brlCents, null);
});

test("orçamento: sem teto, sem câmbio, perto e estourado", () => {
  assert.equal(budgetState(500, null), "none");
  assert.equal(budgetState(null, 1000), "unknown");
  assert.equal(budgetState(700, 1000), "ok");
  assert.equal(budgetState(800, 1000), "near");
  assert.equal(budgetState(1000, 1000), "over");
  assert.equal(monthStart(new Date("2026-12-01T02:00:00Z")), "2026-11-01");
});
