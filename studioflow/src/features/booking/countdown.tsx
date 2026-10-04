"use client";

import { useEffect, useState } from "react";

const part = (value: number, one: string, many: string) => (
  <span className="bk-count-part" key={one}>
    <b>{value}</b> {value === 1 ? one : many}
  </span>
);

/** "Faltam 2 dias 3 h" until the appointment, updated every 30 seconds. */
export function Countdown({ start }: { start: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const left = Date.parse(start) - now;
  if (left <= 0) return null;
  const minutes = Math.floor(left / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts =
    days > 0
      ? [part(days, "dia", "dias"), hours > 0 && part(hours, "hora", "horas")]
      : hours > 0
        ? [part(hours, "hora", "horas"), part(mins, "min", "min")]
        : [part(Math.max(1, mins), "minuto", "minutos")];
  return (
    <p className="bk-countdown" aria-live="off">
      <span className="bk-countdown-label">
        {days === 0 && hours === 0 ? "Falta só" : "Faltam"}
      </span>
      {parts}
    </p>
  );
}
