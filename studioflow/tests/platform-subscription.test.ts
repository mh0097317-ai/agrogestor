import test from "node:test";
import assert from "node:assert/strict";
import { businessFromReference, subscriptionReference } from "../src/services/billing";

test("referência da assinatura liga só à própria casa", () => {
  const id = "872197f5-1b89-4273-9c30-8d823ed3a647";
  assert.equal(businessFromReference(subscriptionReference(id)), id);
  assert.equal(businessFromReference("studioflow-fee:" + id), null);
  assert.equal(businessFromReference("studioflow-sub:../../x"), null);
  assert.equal(businessFromReference(null), null);
});
