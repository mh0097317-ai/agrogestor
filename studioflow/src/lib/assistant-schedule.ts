const clockParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    day: days.indexOf(values.weekday),
    minute: Number(values.hour) * 60 + Number(values.minute),
  };
};

function minutes(value: string) {
  const clock = value.slice(0, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) return null;
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

/** Uses the business's configured days/hours and the São Paulo wall clock. */
export function assistantScheduleOpen(
  schedule: {
    enabled: boolean;
    days: number[];
    start: string;
    end: string;
  },
  at = new Date(),
) {
  if (!schedule.enabled) return true;
  const start = minutes(schedule.start),
    end = minutes(schedule.end);
  if (start === null || end === null || !schedule.days.length) return false;
  const { day, minute } = clockParts(at);
  if (start < end)
    return schedule.days.includes(day) && minute >= start && minute < end;
  const previousDay = (day + 6) % 7;
  return (
    (schedule.days.includes(day) && minute >= start) ||
    (schedule.days.includes(previousDay) && minute < end)
  );
}
