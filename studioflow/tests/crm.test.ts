import { test } from "node:test";
import assert from "node:assert/strict";
import {
  birthdayMessage,
  canMarket,
  daysToBirthday,
  reviewRequestMessage,
  upcomingBirthdays,
} from "../src/lib/crm";
import { optOutPattern } from "../src/services/customer-crm";
import type { Customer } from "../src/types";

const c = (name: string, birthDate?: string, consent?: boolean): Customer => ({
  id: name, businessId: "b", name, phone: "11999990000", visits: 0, totalSpent: 0,
  createdAt: "2026-01-01T00:00:00Z", birthDate, marketingConsent: consent,
});

test("aniversário: hoje, virada de ano e 29 de fevereiro", () => {
  assert.equal(daysToBirthday("1990-11-25", "2026-11-25"), 0);
  assert.equal(daysToBirthday("1990-01-02", "2026-12-30"), 3);
  assert.equal(daysToBirthday("2000-02-29", "2027-02-27"), 1);
  const list = upcomingBirthdays([c("Ana", "1990-11-30"), c("Bia", "1990-11-25"), c("Caio", "1990-12-20"), c("Davi")], "2026-11-25");
  assert.deepEqual(list.map((b) => b.customer.name), ["Bia", "Ana"]);
});

test("marketing só com consentimento explícito", () => {
  assert.equal(canMarket(c("Ana")), false);
  assert.equal(canMarket(c("Ana", undefined, false)), false);
  assert.equal(canMarket(c("Ana", undefined, true)), true);
  assert.match(birthdayMessage(c("Ana Paula"), "Casa"), /responder SAIR/);
});

test("pedido de avaliação neutro: não pergunta se gostou antes do link", () => {
  const text = reviewRequestMessage({ customerName: "Ana Paula", businessName: "Casa", reviewUrl: "https://maps.google.com/x" });
  assert.match(text, /seja ela qual for/);
  assert.doesNotMatch(text, /gostou|5 estrelas|cinco estrelas|satisfeit/i);
  assert.match(reviewRequestMessage({ customerName: "Ana", businessName: "Casa" }), /seja o que for/);
});

test("SAIR tira do marketing; frases comuns não", () => {
  for (const t of ["SAIR", "sair", " Parar! ", "stop"]) assert.ok(optOutPattern.test(t), t);
  for (const t of ["quero sair às 18h", "posso parar o carro?", ""]) assert.equal(optOutPattern.test(t), false, t);
});
