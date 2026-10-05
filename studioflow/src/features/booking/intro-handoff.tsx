"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Business } from "@/types";
import { BookingIntro, type IntroPhase } from "./booking-intro";

/**
 * The opening that starts on the business page when someone taps
 * "Agendar" and ends on the booking: it lives in the [slug] layout, so the
 * same paper stays on screen while the route changes underneath.
 */
type Handoff = {
  business: Pick<Business, "name" | "logo" | "category">;
  phase: IntroPhase;
  startedAt: number;
};
let state: Handoff | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const timers: number[] = [];
const clearTimers = () => timers.splice(0).forEach((id) => window.clearTimeout(id));

/** Minimum time on screen, so the paper, mark and name finish arriving. */
const minimum = 1150;
const liftTime = 720;

function set(next: Handoff | null) {
  state = next;
  emit();
}
export function startHandoff(business: Handoff["business"]) {
  clearTimers();
  set({ business, phase: "on", startedAt: Date.now() });
  // Safety: never stay over the screen if the booking does not answer.
  timers.push(window.setTimeout(finishHandoff, 9000));
}
/** The booking is ready underneath: lift once the opening had its moment. */
export function finishHandoff() {
  if (!state || state.phase !== "on") return;
  clearTimers();
  const wait = Math.max(0, minimum - (Date.now() - state.startedAt));
  timers.push(
    window.setTimeout(() => {
      if (state) set({ ...state, phase: "lift" });
      timers.push(window.setTimeout(() => set(null), liftTime));
    }, wait),
  );
}
export function cancelHandoff() {
  clearTimers();
  set(null);
}
/** True while an opening handed over by the page is on screen. */
export const handoffActive = () => state?.phase === "on";

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function HandoffLayer() {
  const current = useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
  // Back from history: no paper over the page.
  useEffect(() => {
    window.addEventListener("popstate", cancelHandoff);
    return () => window.removeEventListener("popstate", cancelHandoff);
  }, []);
  if (!current) return null;
  return (
    <BookingIntro
      business={current.business}
      phase={current.phase}
      onPhase={(phase) => phase === "lift" && finishHandoff()}
      mode="enter"
      hold={0}
    />
  );
}
