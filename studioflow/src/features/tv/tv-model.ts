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
  const todayAppointments = store.appointments.filter(
    (item) => businessDay(item.start) === today,
  );
  const day = todayAppointments
    .filter(
      (item) => open.includes(item.status) && businessDay(item.start) === today,
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  const time = now.getTime();
  const team: TvSeat[] = store.professionals
    .filter((person) => person.active)
    .map((professional) => {
      const mine = day.filter(
        (item) => item.professionalId === professional.id,
      );
      const current =
        mine.find((item) => item.status === "in_progress") ||
        mine.find(
          (item) =>
            new Date(item.start).getTime() <= time &&
            new Date(item.end).getTime() > time,
        );
      const next = mine.find(
        (item) => item !== current && new Date(item.start).getTime() > time,
      );
      const localClock = new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);
      const works =
        professional.days.includes(weekday) &&
        store.settings.openDays.includes(weekday) &&
        localClock >= professional.start &&
        localClock < professional.end &&
        localClock >= store.settings.openStart &&
        localClock < store.settings.openEnd &&
        !(
          professional.breakStart &&
          professional.breakEnd &&
          localClock >= professional.breakStart &&
          localClock < professional.breakEnd
        );
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
      return (
        order[a.state] - order[b.state] ||
        a.professional.name.localeCompare(b.professional.name)
      );
    });
  const upcoming = day.filter(
    (item) =>
      item.status !== "in_progress" && new Date(item.end).getTime() > time,
  );
  const arrivals = day
    .filter((item) => item.checkedInAt && item.status !== "in_progress")
    .sort((a, b) => (b.checkedInAt || "").localeCompare(a.checkedInAt || ""));
  return {
    team,
    upcoming,
    arrivals,
    total: todayAppointments.filter((a) => a.status !== "cancelled").length,
    serving: day.filter((a) => a.status === "in_progress").length,
    completed: todayAppointments.filter((a) => a.status === "completed").length,
    expected: upcoming.filter((a) => !a.checkedInAt).length,
  };
}
