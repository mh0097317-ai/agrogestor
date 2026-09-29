/** Máscara de telefone BR enquanto digita: (11) 99999-9999 */
export function mascaraTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").replace(/^55(?=\d{11})/, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
