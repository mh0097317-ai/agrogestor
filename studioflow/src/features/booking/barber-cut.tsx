"use client";

import { useEffect, useRef, useState } from "react";
import { monogram } from "@/lib/utils";
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
 * Transition into the time step: the shop's own photos follow one another
 * with a slow push-in, under its name, then the scene lifts to reveal the
 * calendar. Without photos, the shop's mark alone. Kept in the page while
 * the first steps are open so the photos are already loaded. Tap to skip.
 */
export function BarberCut({
  active,
  name,
  logo,
  photos,
  onDone,
}: {
  active: boolean;
  /** Business name for the caption. */
  name: string;
  logo?: string;
  /** Work photos, cover or service photos, best first. */
  photos: string[];
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "play" | "lift">("idle");
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts the timed scene when it is asked for
    setPhase("play");
    const lift = window.setTimeout(() => setPhase("lift"), 2300);
    const end = window.setTimeout(() => {
      setPhase("idle");
      done.current();
    }, 3000);
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

  const shown = [...new Set(photos.filter(Boolean))].slice(0, 3);
  return (
    <div
      className={`bk-cut is-${phase} ${shown.length ? "" : "is-mark"}`}
      aria-hidden="true"
      onClick={skip}
    >
      <div className="bk-cut-photos">
        {shown.map((src, index) => (
          <img
            key={src}
            src={src}
            alt=""
            decoding="async"
            style={{ animationDelay: `${index * 700}ms`, zIndex: index }}
          />
        ))}
      </div>
      <span className="bk-cut-bar is-top" />
      <span className="bk-cut-bar is-bottom" />
      <div className="bk-cut-caption">
        <span className="bk-cut-logo">
          {logo ? <img src={logo} alt="" /> : monogram(name)}
        </span>
        <small>{name}</small>
        <strong>Separando a sua cadeira</strong>
        <span className="bk-cut-rule" />
      </div>
    </div>
  );
}
