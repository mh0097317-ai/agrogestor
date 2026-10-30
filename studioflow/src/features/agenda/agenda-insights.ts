import { businessDay, localDay } from "@/lib/utils";
import type { Appointment, Professional, Store } from "@/types";
import { appointmentMinute, minuteOf, workingRange } from "./agenda-helpers";

export interface FreeWindow {
  start: number;
  end: number;
}

const open = (a: Appointment) => !["cancelled", "no_show"].includes(a.status);

/** Busy stretches of one professional on one day, in minutes, sorted. */
function busyOn(data: Store, professional: Professional, date: Date) {
  const day = localDay(date);
  const busy: [number, number][] = data.appointments
    .filter(
      (a) =>
        a.professionalId === professional.id &&
        open(a) &&
        businessDay(a.start) === day,
    )
    .map((a) => [
      appointmentMinute(a.start),
      appointmentMinute(a.end) + data.settings.buffer,
    ]);
  for (const block of data.blockedTimes) {
    if (block.professionalId !== professional.id) continue;
    if (businessDay(block.start) > day || businessDay(block.end) < day)
      continue;
    busy.push([
      businessDay(block.start) < day ? 0 : appointmentMinute(block.start),
      businessDay(block.end) > day ? 1440 : appointmentMinute(block.end),
    ]);
  }
  if (professional.breakStart && professional.breakEnd) {
    const start = minuteOf(professional.breakStart);
    const end = minuteOf(professional.breakEnd);
    if (end > start) busy.push([start, end]);
  }
  return busy.sort((a, b) => a[0] - b[0]);
}

/**
 * Free stretches left in a professional's day that fit the shortest service
 * they do. `from` (minutes since midnight) hides what has already passed.
 */
export function freeWindows(
  data: Store,
  professional: Professional,
  date: Date,
  from = 0,
): FreeWindow[] {
  const range = workingRange(data, professional, date);
  if (!range) return [];
  const durations = data.services
    .filter((s) => s.active && s.professionalIds.includes(professional.id))
    .map((s) => s.duration);
  if (!durations.length) return [];
  const shortest = Math.min(...durations);
  const windows: FreeWindow[] = [];
  let cursor = Math.max(range.start, Math.ceil(from / 5) * 5);
  for (const [start, end] of [
    ...busyOn(data, professional, date),
    [range.end, range.end] as [number, number],
  ]) {
    const stop = Math.min(start, range.end);
    if (stop - cursor >= shortest) windows.push({ start: cursor, end: stop });
    cursor = Math.max(cursor, end);
    if (cursor >= range.end) break;
  }
  return windows;
}

export interface WeekHeat {
  hours: number[];
  rows: { date: Date; cells: (number | null)[] }[];
}

/** Booked share of the team's working time, per day and hour. */
export function weekHeat(
  data: Store,
  days: Date[],
  professionals: Professional[],
): WeekHeat {
  const first = Math.floor(minuteOf(data.settings.openStart) / 60);
  const last = Math.ceil(minuteOf(data.settings.openEnd) / 60);
  const hours = Array.from(
    { length: Math.max(0, last - first) },
    (_, i) => first + i,
  );
  const rows = days
    .filter((date) => data.settings.openDays.includes(date.getDay()))
    .map((date) => {
      const capacity = hours.map(() => 0);
      const booked = hours.map(() => 0);
      const day = localDay(date);
      for (const person of professionals) {
        const range = workingRange(data, person, date);
        if (!range) continue;
        const pause =
          person.breakStart && person.breakEnd
            ? [minuteOf(person.breakStart), minuteOf(person.breakEnd)]
            : null;
        const entries = data.appointments.filter(
          (a) =>
            a.professionalId === person.id &&
            open(a) &&
            businessDay(a.start) === day,
        );
        hours.forEach((hour, i) => {
          const from = Math.max(hour * 60, range.start);
          const to = Math.min(hour * 60 + 60, range.end);
          if (to <= from) return;
          let minutes = to - from;
          if (pause)
            minutes -= Math.max(
              0,
              Math.min(to, pause[1]) - Math.max(from, pause[0]),
            );
          capacity[i] += Math.max(0, minutes);
          for (const a of entries)
            booked[i] += Math.max(
              0,
              Math.min(to, appointmentMinute(a.end)) -
                Math.max(from, appointmentMinute(a.start)),
            );
        });
      }
      return {
        date,
        cells: capacity.map((c, i) => (c ? Math.min(1, booked[i] / c) : null)),
      };
    });
  return { hours, rows };
}

const parts = [
  { name: "de manhã", from: 0, to: 12 },
  { name: "à tarde", from: 12, to: 18 },
  { name: "à noite", from: 18, to: 24 },
];
const weekday = (date: Date) =>
  ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][
    date.getDay()
  ];

export interface WeakSpot {
  title: string;
  detail: string;
  occupancy: number;
}

/**
 * The emptiest part of the week still ahead (or of the whole week when it
 * has passed), with the other days that look the same in that period.
 */
export function weakSpot(
  data: Store,
  heat: WeekHeat,
  today: string,
): WeakSpot | null {
  const ahead = heat.rows.filter((row) => localDay(row.date) >= today);
  const rows = ahead.length ? ahead : heat.rows;
  const spots = rows.flatMap((row) =>
    parts.map((part) => {
      let capacity = 0;
      let share = 0;
      heat.hours.forEach((hour, i) => {
        const cell = row.cells[i];
        if (cell === null || hour < part.from || hour >= part.to) return;
        capacity += 1;
        share += cell;
      });
      return {
        row,
        part,
        hours: capacity,
        occupancy: capacity ? share / capacity : 1,
      };
    }),
  );
  const candidates = spots
    .filter((spot) => spot.hours >= 2 && spot.occupancy < 0.5)
    .sort((a, b) => a.occupancy - b.occupancy);
  const worst = candidates[0];
  if (!worst) return null;
  const alike = candidates
    .filter(
      (spot) =>
        spot.part === worst.part && spot.occupancy <= worst.occupancy + 0.15,
    )
    .slice(0, 2)
    .sort((a, b) => a.row.date.getTime() - b.row.date.getTime());
  const names = alike.map((spot) => weekday(spot.row.date));
  const occupancy =
    alike.reduce((sum, spot) => sum + spot.occupancy, 0) / alike.length;
  const many = names.length > 1;
  const start = Math.max(worst.part.from, heat.hours[0] ?? 0);
  const end = Math.min(worst.part.to, (heat.hours.at(-1) ?? 23) + 1);
  return {
    title: `Pouco movimento ${names.join(" e ")} ${worst.part.name}.`,
    detail: `Das ${start}h às ${end}h ${many ? "esses dias ficam" : "esse dia fica"} com ${Math.round(occupancy * 100)}% das cadeiras ocupadas. Chamar os clientes que sumiram pode encher esses horários.`,
    occupancy,
  };
}
