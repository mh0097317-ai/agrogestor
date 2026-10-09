export type TimePeriod = "all" | "morning" | "afternoon" | "evening";
export const timePeriods = [
  { id: "morning" as const, label: "Manhã", start: 0, end: 12 },
  { id: "afternoon" as const, label: "Tarde", start: 12, end: 18 },
  { id: "evening" as const, label: "Noite", start: 18, end: 24 },
];
export function matchesTimePeriod(time: string, period: TimePeriod = "all") {
  const hour = Number(time.split(":")[0]);
  const range = timePeriods.find((item) => item.id === period);
  return (
    Number.isFinite(hour) &&
    hour >= 0 &&
    hour < 24 &&
    (!range || (hour >= range.start && hour < range.end))
  );
}
/** Only explicit preferences; "amanhã" is a date, never a morning request. */
export function requestedTimePeriod(text: string): TimePeriod {
  const clean = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const positive = clean.replace(
    /\bnao\s+(?:(?:quero|posso|consigo|prefiro)\s+)?(?:(?:de|pela|na|a)\s+)?(?:manha|tarde|noite)\b/g,
    "",
  );
  const choices: TimePeriod[] = [];
  if (/\b(?:de|pela|na|a) manha\b|\b(?:prefiro|quero) manha\b/.test(positive))
    choices.push("morning");
  if (/\b(?:de|pela|na|a) tarde\b|\b(?:prefiro|quero) tarde\b/.test(positive))
    choices.push("afternoon");
  if (/\b(?:de|pela|na|a) noite\b|\b(?:prefiro|quero) noite\b/.test(positive))
    choices.push("evening");
  return choices.length === 1 ? choices[0] : "all";
}
