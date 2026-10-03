import type { CSSProperties } from "react";

export function businessClock(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const weekday = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
  ).getUTCDay();
  return { weekday, time: `${parts.hour}:${parts.minute}` };
}

export function publicAccentStyle(color?: string): CSSProperties | undefined {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return undefined;
  let rgb = [1, 3, 5].map((index) =>
    parseInt(color.slice(index, index + 2), 16),
  );
  const luminance = (values: number[]) =>
    values
      .map((value) => {
        const channel = value / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      })
      .reduce(
        (total, value, index) =>
          total + value * [0.2126, 0.7152, 0.0722][index],
        0,
      );
  // Keep white button labels readable even when the chosen brand color is light.
  while (luminance(rgb) > 0.13)
    rgb = rgb.map((value) => Math.floor(value * 0.9));
  const accent = `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  return {
    "--public-cta": `linear-gradient(135deg, #07111F 0%, #0D2847 55%, ${accent} 100%)`,
  } as CSSProperties;
}
