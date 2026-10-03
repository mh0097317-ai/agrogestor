import assert from "node:assert/strict";
import test from "node:test";
import { customerDays, customerNeedsReturn } from "../src/lib/customer-metrics";
import type { Customer } from "../src/types";

const customer: Customer = {
  id: "qa",
  businessId: "qa",
  name: "Cliente QA",
  phone: "11999999991",
  visits: 3,
  totalSpent: 100,
  createdAt: "2026-01-01T12:00:00Z",
  lastVisit: "2026-08-28T13:00:00Z",
  returnInterval: 20,
};
test("retorno usa histórico suficiente e a mesma tolerância no painel e CRM", () => {
  assert(customerNeedsReturn(customer, "2026-10-02T18:00:00Z"));
  assert(
    !customerNeedsReturn(
      { ...customer, lastVisit: "2026-09-02T12:00:00Z" },
      "2026-10-02T18:00:00Z",
    ),
  );
  assert(
    !customerNeedsReturn(
      { ...customer, returnInterval: undefined },
      "2026-10-02T18:00:00Z",
    ),
  );
  assert(
    !customerNeedsReturn(
      { ...customer, lastVisit: undefined },
      "2026-10-02T18:00:00Z",
    ),
  );
});
test("última visita considera a virada do dia em São Paulo", () => {
  assert.equal(customerDays("2026-10-01T23:00:00Z", "2026-10-02T01:00:00Z"), 0);
  assert.equal(customerDays("2026-10-01T23:00:00Z", "2026-10-02T04:00:00Z"), 1);
});
