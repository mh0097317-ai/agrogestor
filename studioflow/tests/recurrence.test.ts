import test from "node:test";
import assert from "node:assert/strict";
import { dayAfter, recurrenceStarts, suggestedReturnDays } from "../src/lib/recurrence";

test("repetição semanal mantém o horário e respeita os limites", () => {
  const first = "2026-12-04T21:00:00.000Z"; // sexta 18h em Brasília
  assert.deepEqual(recurrenceStarts(first, 1, 3), [
    "2026-12-11T21:00:00.000Z",
    "2026-12-18T21:00:00.000Z",
  ]);
  assert.equal(recurrenceStarts(first, 2, 2)[0], "2026-12-18T21:00:00.000Z");
  assert.equal(recurrenceStarts(first, 1, 99).length, 11); // no máximo 12 no total
  assert.equal(recurrenceStarts(first, 1, 1).length, 0);
});

test("próximo atendimento pela mediana dos intervalos do cliente", () => {
  assert.equal(suggestedReturnDays([]), 21);
  assert.equal(
    suggestedReturnDays(["2026-09-01T12:00:00Z", "2026-09-29T12:00:00Z", "2026-10-27T12:00:00Z"]),
    28,
  );
  // Intervalo fora do razoável (2 dias) é ignorado.
  assert.equal(suggestedReturnDays(["2026-10-01T12:00:00Z", "2026-10-03T12:00:00Z"]), 21);
  assert.equal(dayAfter("2026-12-04T21:00:00.000Z", 21), "2026-12-25");
});
