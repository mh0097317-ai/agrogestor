"use client";

import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "./motion";

const seenKey = (slug: string) => `studioflow:cut:${slug}`;

/** The cut plays once per visit, on the way to the times; never with reduced motion. */
export function shouldPlayCut(slug: string) {
  if (typeof window === "undefined" || reducedMotion()) return false;
  try {
    return !sessionStorage.getItem(seenKey(slug));
  } catch {
    return true;
  }
}
export function markCutSeen(slug: string) {
  try {
    sessionStorage.setItem(seenKey(slug), "1");
  } catch {
    // Without storage it may simply play again next time.
  }
}

/**
 * Transition into the time step: real footage of a barber at work, framed
 * like a film strip, then the scene lifts to reveal the calendar. Kept in
 * the page while the first steps are open so the clip is already loaded.
 * Tap to skip.
 */
export function BarberCut({
  active,
  name,
  onDone,
}: {
  active: boolean;
  /** Business name for the caption. */
  name: string;
  onDone: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"idle" | "play" | "lift">("idle");
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts the timed scene when it is asked for
    setPhase("play");
    const clip = video.current;
    if (clip) {
      clip.currentTime = 0;
      void clip.play().catch(() => undefined);
    }
    const lift = window.setTimeout(() => setPhase("lift"), 1900);
    const end = window.setTimeout(() => {
      setPhase("idle");
      done.current();
    }, 2600);
    return () => {
      window.clearTimeout(lift);
      window.clearTimeout(end);
    };
  }, [active]);

  function skip() {
    if (phase !== "play") return;
    setPhase("lift");
    window.setTimeout(() => {
      setPhase("idle");
      done.current();
    }, 650);
  }

  return (
    <div
      className={`bk-cut is-${phase}`}
      aria-hidden="true"
      onClick={skip}
    >
      <video
        ref={video}
        muted
        playsInline
        preload="auto"
        poster="/media/barber-cut.jpg"
        tabIndex={-1}
      >
        <source src="/media/barber-cut.webm" type="video/webm" />
        <source src="/media/barber-cut.mp4" type="video/mp4" />
      </video>
      <span className="bk-cut-bar is-top" />
      <span className="bk-cut-bar is-bottom" />
      <div className="bk-cut-caption">
        <small>{name}</small>
        <strong>Separando a sua cadeira</strong>
        <span className="bk-cut-rule" />
      </div>
    </div>
  );
}
