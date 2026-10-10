/** Relative provider dates use the timestamp of this message, in Sao Paulo. */
export function resolveBookingDate(
  value: string,
  at: string | Date = new Date(),
) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const parsed = new Date(normalized + "T12:00:00Z");
    return Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === normalized
      ? normalized
      : "";
  }
  const instant = new Date(at);
  if (!Number.isFinite(instant.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  const date = new Date(day + "T12:00:00Z");
  let offset: number;
  if (normalized === "hoje") offset = 0;
  else if (normalized === "amanha") offset = 1;
  else if (normalized === "depois de amanha") offset = 2;
  else {
    const match =
      /^(?:(?:proxima?|na|no) )?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?$/.exec(
        normalized,
      );
    if (!match) return "";
    const target = [
      "domingo",
      "segunda",
      "terca",
      "quarta",
      "quinta",
      "sexta",
      "sabado",
    ].indexOf(match[1]);
    offset = (target - date.getUTCDay() + 7) % 7;
    if (!offset && /^proxima? /.test(normalized)) offset = 7;
  }
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
