import assert from "node:assert/strict";
import test from "node:test";
import { billingEmail, onboardingEmail, sampleEmail, weeklyEmail } from "../src/services/email/platform-emails";

test("cobrança: avisa o vencimento, mostra valor e o link de pagamento", () => {
  const email = billingEmail({
    to: "dono@ex.com",
    stage: "soon",
    owner: "Carlos Souza",
    business: "Navalha",
    plan: "Profissional",
    price: 99,
    until: "2026-10-20T03:00:00.000Z",
    link: "https://pagar.exemplo/123",
  });
  assert.match(email.subject, /vence em 3 dias/);
  assert.match(email.text, /Oi, Carlos!/);
  assert.match(email.text, /R\$\s?99,00/);
  assert.match(email.html, /https:\/\/pagar\.exemplo\/123/);
});

test("cobrança atrasada fala em acesso pausado", () => {
  const email = billingEmail({
    to: "dono@ex.com",
    stage: "late",
    owner: "",
    business: "Navalha",
    plan: "",
    price: 59,
    until: null,
    link: "https://pagar.exemplo/1",
  });
  assert.match(email.subject, /pausado/);
  assert.match(email.text, /^Seu acesso ficou pausado/);
  assert.match(email.text, /Olá!/);
});

test("boas-vindas: três passos com nome da casa e link", () => {
  const email = onboardingEmail("welcome", {
    to: "dono@ex.com",
    owner: "Ana",
    business: "Navalha",
    slug: "navalha",
  });
  assert.match(email.subject, /Boas-vindas/);
  assert.match(email.text, /1\. Cadastre/);
  assert.match(email.text, /\/navalha/);
});

test("o texto do cliente é escapado no HTML", () => {
  const email = onboardingEmail("share", {
    to: "dono@ex.com",
    owner: "<b>x</b>",
    business: "Casa <script>",
    slug: "casa",
  });
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
});

test("relatório semanal leva o PDF anexo em base64", () => {
  const email = weeklyEmail({
    to: "dono@ex.com",
    owner: "Ana",
    business: "Navalha",
    week: "2026-10-05",
    pdf: new Uint8Array([37, 80, 68, 70]),
  });
  assert.equal(email.attachments?.[0].content, "JVBERg==");
  assert.match(email.attachments![0].filename, /2026-10-05\.pdf$/);
});

test("todas as prévias do admin são geradas", () => {
  for (const kind of ["billing", "welcome", "setup", "share", "weekly"] as const) {
    const email = sampleEmail(kind);
    assert.ok(email.subject.length > 5);
    assert.match(email.html, /^<!doctype html>/);
  }
});
