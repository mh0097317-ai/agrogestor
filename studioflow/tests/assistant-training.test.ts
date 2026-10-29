import test from "node:test";
import assert from "node:assert/strict";
import type { CreateMessage } from "../src/services/assistant/agent";
import {
  draftTraining,
  trainingSchema,
} from "../src/services/assistant/training";
import { brazilianPhone } from "../src/lib/brazilian-phone";

test("professional phones accept Brazilian landlines, mobile and international paste without guessing missing digits", () => {
  for (const phone of [
    "62984674376",
    "(62) 98467-4376",
    "+55 (62) 98467-4376",
    "(62) 3246-2462",
    "+55 55 99999-8888",
  ])
    assert.equal(brazilianPhone(phone), true, phone);
  for (const phone of [
    "62 946-2462",
    "(62) 98467",
    "(20) 98467-4376",
    "629846743761",
    "(62) 88467-4376",
  ])
    assert.equal(brazilianPhone(phone), false, phone);
});

test("training input is bounded and cannot select another business or a tool", () => {
  assert.equal(
    trainingSchema.safeParse({
      tone: "acolhedor",
      notes: "Atender com carinho",
      businessId: "other",
    }).success,
    false,
  );
  assert.equal(
    trainingSchema.safeParse({ tone: "acolhedor", notes: "x".repeat(1001) })
      .success,
    false,
  );
});

test("training produces only a draft using one provider call without customer tools", async () => {
  let calls = 0;
  const create: CreateMessage = async (params) => {
    calls++;
    assert.equal(params.tools, undefined);
    assert.equal(params.messages.length, 1);
    assert.equal(params.max_tokens, 900);
    return {
      content: [
        {
          type: "text",
          text: "Cumprimente com carinho e consulte a agenda antes de oferecer horários.",
        },
      ],
      stop_reason: "end_turn",
    } as Awaited<ReturnType<CreateMessage>>;
  };
  const result = await draftTraining(
    trainingSchema.parse({
      tone: "acolhedor",
      notes: "Quero um atendimento caloroso",
    }),
    create,
  );
  assert.match(result.instructions, /consulte a agenda/);
  assert.equal(calls, 1);
});

test("truncated or oversized training output must never be offered for saving", async () => {
  for (const [text, stop] of [
    ["Resposta incompleta", "max_tokens"],
    ["x".repeat(1501), "end_turn"],
    ["", "end_turn"],
  ]) {
    const create = (async () => ({
      content: [{ type: "text", text }],
      stop_reason: stop,
    })) as unknown as CreateMessage;
    await assert.rejects(
      draftTraining(
        trainingSchema.parse({
          tone: "profissional",
          notes: "Atender com clareza",
        }),
        create,
      ),
      /incompleta/,
    );
  }
});
