import test from "node:test";
import assert from "node:assert/strict";
import {
  fallbackMessage,
  formatLeadPhone,
  instagramHandle,
  isMobile,
  normalizePhone,
  readSite,
  scoreLead,
  whatsappLink,
  type LeadFacts,
} from "../src/services/leads/lead-logic";
import { blockedAddress, fetchPublicPage } from "../src/services/leads/safe-fetch";
import { demoPlaces } from "../src/services/leads/providers";

const base: LeadFacts = {
  name: "Barbearia do Zé",
  phone: "62994234504",
  website: "",
  instagram: "barbeariadoze",
  rating: 4.9,
  reviews: 160,
  city: "Goiânia",
  signals: {},
};

test("captação: telefone vira DDD + número e só celular abre WhatsApp", () => {
  assert.equal(normalizePhone("+55 (62) 99423-4504"), "62994234504");
  assert.equal(normalizePhone("062 3223-4503"), "6232234503");
  assert.equal(normalizePhone("556232234503"), "6232234503");
  assert.equal(normalizePhone("1234"), "");
  assert.equal(normalizePhone(null), "");
  assert.equal(isMobile("62994234504"), true);
  assert.equal(isMobile("6232234503"), false);
  assert.equal(formatLeadPhone("62994234504"), "(62) 99423-4504");
  assert.equal(formatLeadPhone("6232234503"), "(62) 3223-4503");
  assert.equal(
    whatsappLink("62994234504", "Oi, tudo bem?"),
    "https://wa.me/5562994234504?text=Oi%2C%20tudo%20bem%3F",
  );
});

test("captação: lê o site atrás de agenda online, WhatsApp e Instagram", () => {
  const booksy = readSite(
    '<a href="https://booksy.com/pt-br/123">Agende</a><a href="https://www.instagram.com/vintage.barber/">ig</a>',
  );
  assert.equal(booksy.bookingTool, "Booksy");
  assert.equal(booksy.usesStudioFlow, false);
  assert.equal(booksy.instagram, "vintage.barber");
  const ours = readSite('<a href="https://app.studioflowapp.tech/casa/agendar">Agendar</a>');
  assert.equal(ours.usesStudioFlow, true);
  const plain = readSite('<a href="https://wa.me/5562999990000">Chama</a><a href="https://instagram.com/p/abc">post</a>');
  assert.equal(plain.bookingTool, null);
  assert.equal(plain.whatsappOnSite, true);
  assert.equal(plain.instagram, "");
  assert.equal(instagramHandle("@dom.barba"), "dom.barba");
  assert.equal(instagramHandle("https://instagram.com/dombarba?igsh=x"), "dombarba");
  assert.equal(instagramHandle("não tem"), "");
});

test("captação: nota sobe para casa cheia sem agenda online e zera para quem já usa StudioFlow", () => {
  const hot = scoreLead(base);
  assert.equal(hot.score, 35 + 20 + 15 + 10 + 8 + 7);
  assert.ok(hot.reasons.includes("Sem agendamento online"));
  assert.ok(hot.reasons.includes("Celular com WhatsApp"));
  const switching = scoreLead({ ...base, website: "x.com", signals: { siteRead: true, bookingTool: "Trinks" } });
  assert.ok(switching.score < hot.score);
  assert.ok(switching.reasons.some((reason) => reason.includes("Trinks")));
  const unknown = scoreLead({ ...base, website: "x.com", signals: { siteError: "site não abriu" } });
  assert.ok(unknown.reasons.some((reason) => reason.startsWith("Site não abriu")));
  const landline = scoreLead({ ...base, phone: "6232234503", instagram: "", reviews: 5, rating: 3.9 });
  assert.ok(landline.score < 60);
  assert.deepEqual(scoreLead({ ...base, signals: { usesStudioFlow: true } }), {
    score: 0,
    reasons: ["Já usa a StudioFlow"],
  });
  assert.ok(scoreLead(base).score <= 100);
});

test("captação: mensagem de reserva tem um fato, a oferta e a saída", () => {
  const text = fallbackMessage(base, "Matheus Henrique");
  assert.match(text, /Aqui é o Matheus, da StudioFlow/);
  assert.match(text, /160 avaliações/);
  assert.match(text, /30 dias grátis/);
  assert.match(text, /\?/);
  assert.ok(text.trim().endsWith("Se não fizer sentido, é só me falar que eu não mando mais 👍"));
  assert.ok(!/https?:\/\//.test(text));
  const tool = fallbackMessage({ ...base, signals: { bookingTool: "Booksy" } }, "");
  assert.match(tool, /agendam pelo Booksy/);
  assert.match(tool, /Aqui é da StudioFlow/);
});

test("captação: leitura de site recusa rede interna e endereço de metadados", async () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.0.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])
    assert.equal(blockedAddress(ip), true, ip);
  for (const ip of ["8.8.8.8", "177.71.1.1", "2804:14c::1"]) assert.equal(blockedAddress(ip), false, ip);
  assert.deepEqual(await fetchPublicPage("http://127.0.0.1/"), { ok: false, error: "endereço não permitido" });
  assert.deepEqual(await fetchPublicPage("http://169.254.169.254/latest/meta-data"), {
    ok: false,
    error: "endereço não permitido",
  });
  assert.deepEqual(await fetchPublicPage("https://example.com:8443/"), { ok: false, error: "endereço não permitido" });
  assert.deepEqual(await fetchPublicPage("ftp://example.com/"), { ok: false, error: "endereço não permitido" });
  assert.deepEqual(await fetchPublicPage("http://[::1]/"), { ok: false, error: "endereço não permitido" });
  assert.deepEqual(await fetchPublicPage("http://localhost/"), { ok: false, error: "endereço não permitido" });
});

test("captação: demonstração traz casas inventadas e sem rede", () => {
  const places = demoPlaces("Goiânia");
  assert.equal(places.length, 8);
  assert.ok(places.every((place) => place.placeId.startsWith("demo:") && place.address.endsWith("Goiânia")));
});
