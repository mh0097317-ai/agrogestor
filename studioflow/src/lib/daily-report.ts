import { businessDay } from "./utils";
/** A one-hour send window, 15 minutes after closing. Handles midnight. */
export function dailyReportDate(
  now: Date,
  closing: string,
): string | undefined {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(closing)) return;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const minute = Number(values.hour) * 60 + Number(values.minute);
  const [hour, min] = closing.split(":").map(Number);
  const raw = hour * 60 + min + 15,
    scheduled = raw % 1440;
  if ((minute - scheduled + 1440) % 1440 >= 60) return;
  const date = new Date(`${businessDay(now)}T12:00:00Z`);
  date.setUTCDate(
    date.getUTCDate() - Number(minute < scheduled) - Number(raw >= 1440),
  );
  return date.toISOString().slice(0, 10);
}
