import test from "node:test";
import assert from "node:assert/strict";
import {
  validCnpj,
  normalizeCnpj,
  companyRegistry,
} from "../src/lib/company-registry";
test("CNPJ validates numeric and Receita alphanumeric check digits", () => {
  assert.equal(validCnpj("19.131.243/0001-97"), true);
  assert.equal(validCnpj("12.ABC.345/01DE-35"), true);
  for (const value of [
    "",
    "00000000000000",
    "19131243000198",
    "../../etc/passwd",
    "19.131.243/0001-97?x",
  ])
    assert.equal(validCnpj(value), false, value);
  assert.equal(normalizeCnpj("12.abc.345/01de-35"), "12ABC34501DE35");
});
test("company lookup returns only the requested public registration fields", () => {
  const data = companyRegistry({
    cnpj: "19131243000197",
    razao_social: "Empresa Ltda",
    nome_fantasia: "Salão",
    logradouro: "Rua Um",
    numero: "10",
    municipio: "Goiânia",
    uf: "GO",
    ddd_telefone_1: "(62) 99999-9999",
    qsa: [{ cnpj_cpf_do_socio: "private" }],
  });
  assert.equal(data.legalName, "Empresa Ltda");
  assert.match(data.address, /Rua Um 10/);
  assert.equal(data.phone, "62999999999");
  assert.equal(JSON.stringify(data).includes("private"), false);
});
