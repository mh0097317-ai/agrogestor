/** "Sou Gislayniel" or "me chamo Ana" as typed in a chat; the name only. */
export function cleanName(value: string) {
  return value
    .trim()
    .replace(
      /^(?:(?:oi|ol[aá])[,!\s]+)?(?:sou (?:o |a )?|me chamo |meu nome [eé] |aqui [eé] (?:o |a )?|[eé] (?:o |a ))/i,
      "",
    )
    .trim();
}

/** MATHEUS → Matheus; names typed with case are kept. */
export function displayName(value: string) {
  return value === value.toUpperCase()
    ? value.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())
    : value;
}

export const firstName = (value: string) =>
  displayName(cleanName(value).split(/\s+/)[0] || "");
