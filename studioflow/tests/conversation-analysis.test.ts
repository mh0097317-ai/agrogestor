import test from "node:test";
import assert from "node:assert/strict";
import { analysisBlockReason } from "../src/lib/conversation-analysis";
import type { ConversationMessage } from "../src/types";

const now = Date.parse("2026-10-07T22:00:00Z");
const customer: ConversationMessage = {
  id: "pending",
  role: "customer",
  body: "Quanto está o corte?",
  createdAt: new Date(now - 60_000).toISOString(),
};
const input = { channel: "whatsapp", messages: [customer], now };

test("manual analysis admits an exhausted unanswered request but blocks answered and expired requests", () => {
  assert.equal(
    analysisBlockReason({ ...input, run: { state: "FAILED", attempts: 3 } }),
    null,
  );
  for (const role of ["assistant", "staff"] as const)
    assert.match(
      analysisBlockReason({
        ...input,
        messages: [customer, { ...customer, id: role, role }],
      })!,
      /Não há mensagem/,
    );
  assert.match(
    analysisBlockReason({
      ...input,
      messages: [
        { ...customer, createdAt: new Date(now - 25 * 3600_000).toISOString() },
      ],
    })!,
    /24 horas/,
  );
  assert.match(analysisBlockReason({ ...input, channel: "web" })!, /WhatsApp/);
});

test("manual analysis cannot interrupt a lease, duplicate queued work or resend an uncertain delivery", () => {
  assert.match(
    analysisBlockReason({
      ...input,
      processingUntil: new Date(now + 30_000).toISOString(),
    })!,
    /andamento/,
  );
  assert.match(
    analysisBlockReason({
      ...input,
      run: {
        state: "RETRY",
        attempts: 0,
        updated_at: new Date(now - 1000).toISOString(),
      },
    })!,
    /andamento/,
  );
  for (const run of [
    { state: "SENDING", attempts: 1 },
    { state: "FAILED", attempts: 3, error_code: "delivery-unconfirmed" },
  ])
    assert.match(analysisBlockReason({ ...input, run })!, /entrega/);
  assert.equal(
    analysisBlockReason({
      ...input,
      run: {
        state: "RETRY",
        attempts: 0,
        updated_at: new Date(now - 30_000).toISOString(),
      },
    }),
    null,
  );
});
