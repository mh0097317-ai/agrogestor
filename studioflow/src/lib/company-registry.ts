export function normalizeCnpj(value: string) {
  return value.toUpperCase().replace(/[.\/\-\s]/g, "");
}
/** Receita's numeric/alphanumeric CNPJ check digits (ASCII minus 48). */
export function validCnpj(value: string) {
  const id = normalizeCnpj(value);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(id) || /^(.)\1{13}$/.test(id)) return false;
  function digit(part: string) {
    let weight = 2,
      sum = 0;
    for (let i = part.length - 1; i >= 0; i--) {
      sum += (part.charCodeAt(i) - 48) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  }
  return (
    digit(id.slice(0, 12)) === Number(id[12]) &&
    digit(id.slice(0, 13)) === Number(id[13])
  );
}
export interface CompanyRegistry {
  cnpj: string;
  legalName: string;
  tradeName: string;
  address: string;
  phone: string;
  source: "BrasilAPI / Minha Receita";
}
export function companyRegistry(
  data: Record<string, unknown>,
): CompanyRegistry {
  const text = (key: string, max = 120) =>
    typeof data[key] === "string"
      ? (data[key] as string).trim().slice(0, max)
      : "";
  const street = [
    text("descricao_tipo_de_logradouro"),
    text("logradouro"),
    text("numero"),
    text("complemento"),
  ]
    .filter(Boolean)
    .join(" ");
  return {
    cnpj: normalizeCnpj(text("cnpj")),
    legalName: text("razao_social"),
    tradeName: text("nome_fantasia"),
    address: [
      street,
      text("bairro"),
      [text("municipio"), text("uf")].filter(Boolean).join("/"),
      text("cep"),
    ]
      .filter(Boolean)
      .join(", ")
      .slice(0, 250),
    phone: text("ddd_telefone_1", 20).replace(/\D/g, ""),
    source: "BrasilAPI / Minha Receita",
  };
}
