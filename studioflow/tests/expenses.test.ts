import { test } from "node:test";
import assert from "node:assert/strict";
import {
  change,
  expenseInputSchema,
  monthlyDates,
  payables,
  previousPeriod,
  simpleDre,
  type Expense,
} from "../src/lib/expenses";

const base: Omit<Expense, "id" | "amountCents" | "category" | "dueDate" | "paidAt"> = {
  description: "x",
  method: "pix",
  createdAt: "2026-11-01T00:00:00Z",
  voidedAt: null,
  voidReason: null,
};
const e = (id: string, cents: number, category: Expense["category"], due: string, paid: string | null, voided = false): Expense => ({
  ...base, id, amountCents: cents, category, dueDate: due, paidAt: paid,
  voidedAt: voided ? "2026-11-02T00:00:00Z" : null,
});

test("DRE de caixa: só despesas pagas no período e sem estorno", () => {
  const list = [
    e("1", 150000, "aluguel", "2026-11-05", "2026-11-05"),
    e("2", 3333, "contas", "2026-11-10", "2026-11-10"),
    e("3", 99999, "contas", "2026-11-10", "2026-11-10", true), // estornada
    e("4", 5000, "marketing", "2026-11-20", null), // a pagar
    e("5", 7000, "produtos", "2026-10-30", "2026-10-30"), // outro período
  ];
  const dre = simpleDre({
    servicesCents: 300000, productsCents: 10001, commissionCents: 120000,
    expenses: list, from: "2026-11-01", to: "2026-11-30",
  });
  assert.equal(dre.grossCents, 310001);
  assert.equal(dre.expensesCents, 153333);
  assert.equal(dre.resultCents, 310001 - 120000 - 153333);
  assert.deepEqual(dre.lines.map((l) => l.category), ["aluguel", "contas"]);
  assert.ok(Number.isInteger(dre.resultCents));
});

test("sem receita não há margem; variação sem base não vira número", () => {
  const dre = simpleDre({ servicesCents: 0, productsCents: 0, commissionCents: 0, expenses: [], from: "2026-11-01", to: "2026-11-30" });
  assert.equal(dre.margin, null);
  assert.equal(change(100, 0), null);
  assert.equal(change(150, 100), 0.5);
});

test("contas a pagar: vencidas primeiro e estornadas fora", () => {
  const bills = payables([
    e("a", 1000, "contas", "2026-11-30", null),
    e("b", 2000, "contas", "2026-11-01", null),
    e("c", 4000, "contas", "2026-11-01", null, true),
    e("d", 8000, "contas", "2026-11-01", "2026-11-01"),
  ], "2026-11-25");
  assert.deepEqual(bills.open.map((b) => b.id), ["b", "a"]);
  assert.equal(bills.overdueCents, 2000);
  assert.equal(bills.openCents, 3000);
});

test("repetição mensal respeita o fim do mês e período anterior tem o mesmo tamanho", () => {
  assert.deepEqual(monthlyDates("2026-01-31", 3), ["2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.deepEqual(previousPeriod({ from: "2026-11-01", to: "2026-11-30" }), { from: "2026-10-02", to: "2026-10-31" });
  assert.deepEqual(previousPeriod({ from: "2026-11-25", to: "2026-11-25" }), { from: "2026-11-24", to: "2026-11-24" });
});

test("entrada: valor em centavos inteiros e positivo", () => {
  const ok = expenseInputSchema.safeParse({ category: "aluguel", description: "Aluguel", amountCents: 150000, dueDate: "2026-11-05" });
  assert.ok(ok.success);
  assert.equal(expenseInputSchema.safeParse({ category: "aluguel", description: "A", amountCents: 10.5, dueDate: "2026-11-05" }).success, false);
  assert.equal(expenseInputSchema.safeParse({ category: "aluguel", description: "A", amountCents: -1, dueDate: "2026-11-05" }).success, false);
  assert.equal(expenseInputSchema.safeParse({ category: "x", description: "A", amountCents: 1, dueDate: "2026-11-05" }).success, false);
});
