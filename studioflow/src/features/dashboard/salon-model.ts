import { businessDay, dateLabel } from "@/lib/utils";
import type { Appointment, Professional, Store } from "@/types";

/** What a chair shows right now. */
export type ChairState =
  | "busy" // started and within its time
  | "late" // started and past its end
  | "due" // booked for now, not started yet
  | "free"
  | "break"
  | "off";

export interface Chair {
  professional: Professional;
  state: ChairState;
  /** The appointment in the chair, or due now. */
  current?: Appointment;
  next?: Appointment;
  /** 0..1 of the current appointment's time. */
  progress: number;
  /** Minutes left (negative when late). */
  minutesLeft: number;
  /** HH:mm the chair stays free until, when free. */
  freeUntil?: string;
  /** Clients who checked in for this professional and wait. */
  waiting: Appointment[];
}

export interface SalonEvent {
  at: string;
  time: string;
  text: string;
}

export interface SalonModel {
  day: string;
  chairs: Chair[];
  waiting: Appointment[];
  cash: number;
  done: number;
  total: number;
  /** 0..1 of today's working minutes that are booked. */
  occupancy: number;
  /** The first free window today of at least 30 minutes. */
  gap?: { professional: Professional; start: string; minutes: number };
  feed: SalonEvent[];
}

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const weekday = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
});
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Minutes since midnight in São Paulo. */
export function minutesOf(value: string | number | Date) {
  const [h, m] = clock.format(new Date(value)).split(":").map(Number);
  return h * 60 + m;
}
const parse = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const open = (a: Appointment) =>
  a.status === "confirmed" || a.status === "pending";
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

function workingWindow(person: Professional, now: number) {
  const start = parse(person.start);
  const end = parse(person.end);
  const works = person.days.includes(days.indexOf(weekday.format(now)));
  if (!works || start === null || end === null || end <= start) return null;
  const breakStart = parse(person.breakStart);
  const breakEnd = parse(person.breakEnd);
  return {
    start,
    end,
    break:
      breakStart !== null && breakEnd !== null && breakEnd > breakStart
        ? { start: breakStart, end: breakEnd }
        : null,
  };
}

/** The live salon for today, from the workspace data only. */
export function salonModel(data: Store, now = Date.now()): SalonModel {
  const day = businessDay(new Date(now));
  const nowMin = minutesOf(now);
  const people = data.professionals.filter(
    (p) => p.active && p.businessId === data.business.id,
  );
  const today = data.appointments
    .filter(
      (a) =>
        a.businessId === data.business.id &&
        a.status !== "cancelled" &&
        businessDay(a.start) === day,
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  const waiting = today.filter((a) => open(a) && a.checkedInAt);
  let booked = 0;
  let available = 0;
  let gap: SalonModel["gap"];
  const chairs = people.map((person): Chair => {
    const own = today.filter((a) => a.professionalId === person.id);
    const window = workingWindow(person, now);
    if (window) {
      available +=
        window.end -
        window.start -
        (window.break ? window.break.end - window.break.start : 0);
      booked += own
        .filter((a) => a.status !== "no_show")
        .reduce(
          (sum, a) =>
            sum +
            Math.max(0, (Date.parse(a.end) - Date.parse(a.start)) / 60000),
          0,
        );
    }
    const started = own.filter((a) => a.status === "in_progress").at(-1);
    const dueNow = own.find(
      (a) => open(a) && Date.parse(a.start) <= now && Date.parse(a.end) > now,
    );
    const current = started || dueNow;
    const next = own.find(
      (a) => open(a) && a !== current && Date.parse(a.start) > now,
    );
    const mine = waiting.filter(
      (a) => a.professionalId === person.id && a !== current,
    );
    // First free window of 30+ minutes left today for this professional.
    if (window) {
      const busy = own
        .filter((a) => a.status !== "no_show")
        .map((a) => [minutesOf(a.start), minutesOf(a.end)] as const);
      if (window.break) busy.push([window.break.start, window.break.end]);
      busy.sort((a, b) => a[0] - b[0]);
      let cursor = Math.max(window.start, Math.ceil(nowMin / 10) * 10);
      for (const [s, e] of [...busy, [window.end, window.end] as const]) {
        if (s - cursor >= 30) {
          if (!gap || cursor < parse(gap.start)!)
            gap = {
              professional: person,
              start: hhmm(cursor),
              minutes: s - cursor,
            };
          break;
        }
        cursor = Math.max(cursor, e);
      }
    }
    const base = {
      professional: person,
      next,
      waiting: mine,
      progress: 0,
      minutesLeft: 0,
    };
    if (current) {
      const start = Date.parse(current.start);
      const end = Date.parse(current.end);
      const left = Math.ceil((end - now) / 60000);
      if (current.status !== "in_progress")
        return { ...base, current, state: "due" };
      return {
        ...base,
        current,
        state: left < 0 ? "late" : "busy",
        progress: Math.min(
          1,
          Math.max(0, (now - start) / Math.max(1, end - start)),
        ),
        minutesLeft: left,
      };
    }
    if (!window || nowMin < window.start || nowMin >= window.end)
      return { ...base, state: "off" };
    if (
      window.break &&
      nowMin >= window.break.start &&
      nowMin < window.break.end
    )
      return { ...base, state: "break", freeUntil: hhmm(window.break.end) };
    return {
      ...base,
      state: "free",
      freeUntil: next ? dateLabel(next.start, "HH:mm") : hhmm(window.end),
    };
  });
  const ids = new Set(today.map((a) => a.id));
  const cash = data.payments
    .filter((p) => businessDay(p.createdAt) === day)
    .reduce((sum, p) => sum + p.amount, 0);
  const name = (id: string) =>
    first(people.find((p) => p.id === id)?.name || "a equipe");
  const feed: SalonEvent[] = [];
  for (const a of today) {
    if (a.checkedInAt && businessDay(a.checkedInAt) === day)
      feed.push({
        at: a.checkedInAt,
        time: "",
        text: `${a.customerName} chegou e fez check-in.`,
      });
    if (businessDay(a.createdAt) === day) {
      const via = a.bookingChannel?.startsWith("assistant_")
        ? `A recepcionista IA marcou ${a.customerName}`
        : a.bookingChannel === "public_link"
          ? `${a.customerName} marcou pela página`
          : "";
      if (via)
        feed.push({
          at: a.createdAt,
          time: "",
          text: `${via} às ${dateLabel(a.start, "HH:mm")} com ${name(a.professionalId)}.`,
        });
    }
  }
  for (const p of data.payments) {
    if (businessDay(p.createdAt) !== day || !ids.has(p.appointmentId)) continue;
    const a = today.find((item) => item.id === p.appointmentId)!;
    feed.push({
      at: p.createdAt,
      time: "",
      text: `${name(a.professionalId)} recebeu ${p.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de ${a.customerName}.`,
    });
  }
  feed.sort((a, b) => b.at.localeCompare(a.at));
  return {
    day,
    chairs,
    waiting,
    cash,
    done: today.filter((a) => a.status === "completed").length,
    total: today.filter((a) => a.status !== "no_show").length,
    occupancy: available ? Math.min(1, booked / available) : 0,
    gap,
    feed: feed
      .slice(0, 6)
      .map((e) => ({ ...e, time: dateLabel(e.at, "HH:mm") })),
  };
}
