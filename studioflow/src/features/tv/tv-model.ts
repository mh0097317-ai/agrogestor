import { businessDay } from "@/lib/utils";
import type { Appointment, Professional, Store } from "@/types";

/** Na TV da recepção, só o primeiro nome e a inicial do sobrenome. */
export function tvName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.find((word) => /^\p{L}/u.test(word) && word.length > 2);
  return last ? `${first} ${last[0].toUpperCase()}.` : first || "";
}

export interface TvSeat {
  professional: Professional;
  state: "busy" | "next" | "free" | "off";
  current?: Appointment;
  next?: Appointment;
}

const open = ["pending", "confirmed", "in_progress"];

/** O que a recepção precisa ver agora: equipe, próximos e quem já chegou. */
export function tvBoard(store: Store, now = new Date()) {
  const today = businessDay(now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const day = store.appointments
    .filter((item) => open.includes(item.status) && businessDay(item.start) === today)
    .sort((a, b) => a.start.localeCompare(b.start));
  const time = now.getTime();
  const team: TvSeat[] = store.professionals
    .filter((person) => person.active)
    .map((professional) => {
      const mine = day.filter((item) => item.professionalId === professional.id);
      const current =
        mine.find((item) => item.status === "in_progress") ||
        mine.find(
          (item) =>
            new Date(item.start).getTime() <= time && new Date(item.end).getTime() > time,
        );
      const next = mine.find(
        (item) => item !== current && new Date(item.start).getTime() > time,
      );
      const works = professional.days.includes(weekday);
      return {
        professional,
        current,
        next,
        state: current ? "busy" : next ? "next" : works ? "free" : "off",
      } satisfies TvSeat;
    })
    .filter((seat) => seat.state !== "off" || seat.current || seat.next)
    .sort((a, b) => {
      const order = { busy: 0, next: 1, free: 2, off: 3 };
      return order[a.state] - order[b.state] || a.professional.name.localeCompare(b.professional.name);
    });
  const upcoming = day
    .filter((item) => item.status !== "in_progress" && new Date(item.end).getTime() > time)
    .slice(0, 7);
  const arrivals = day
    .filter((item) => item.checkedInAt && item.status !== "in_progress")
    .sort((a, b) => (b.checkedInAt || "").localeCompare(a.checkedInAt || ""));
  return { team, upcoming, arrivals, total: day.length };
}
