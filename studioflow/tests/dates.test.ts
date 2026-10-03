import test from "node:test";
import assert from "node:assert/strict";
import { businessDay, dateLabel } from "../src/lib/utils";
test("agenda mostra horário do estabelecimento e mantém datas de calendário", () => {
  assert.equal(dateLabel("2026-10-02T02:30:00Z", "dd/MM HH:mm"), "01/10 23:30");
  assert.equal(businessDay("2026-10-02T02:30:00Z"), "2026-10-01");
  assert.equal(dateLabel("2026-10-02", "dd/MM/yyyy"), "02/10/2026");
  assert.equal(dateLabel(new Date(2026, 9, 2), "dd/MM/yyyy"), "02/10/2026");
});
test("data simples já é dia do estabelecimento e não volta um dia", () => {
  assert.equal(businessDay("2026-10-02"), "2026-10-02");
  assert.equal(businessDay("2026-10-03T01:30:00Z"), "2026-10-02");
});
