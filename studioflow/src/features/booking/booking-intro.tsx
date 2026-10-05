"use client";

import { useEffect, useState } from "react";
import type { Business } from "@/types";
import { PublicImage } from "@/features/public/public-ui";
import { monogram } from "@/lib/utils";
import "@/features/public/public.css";
import "./booking.css";

export type IntroPhase = "on" | "lift" | "off";

const seenKey = (slug: string) => `studioflow:intro:${slug}`;

/**
 * Whether the opening should play: once per visit (session), never with
 * reduced motion. Read once, in the browser.
 */
export function shouldPlayIntro(slug: string) {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return false;
  try {
    return !sessionStorage.getItem(seenKey(slug));
  } catch {
    // Storage blocked: play it, it is short.
    return true;
  }
}

export function markIntroSeen(slug: string) {
  try {
    sessionStorage.setItem(seenKey(slug), "1");
  } catch {
    // Nothing to remember without storage.
  }
}

/**
 * Opening of the booking: the business mark on paper, a brass rule drawn
 * under it, the name, then the paper lifts like a curtain. Tap to skip.
 */
export function BookingIntro({
  business,
  phase,
  onPhase,
  mode = "full",
  hold = 1250,
}: {
  business: Pick<Business, "name" | "logo" | "category">;
  phase: IntroPhase;
  onPhase: (phase: IntroPhase) => void;
  /** "enter": the paper rises over the page that was tapped. */
  mode?: "full" | "enter";
  /** Time on screen before lifting; 0 keeps it until the page changes. */
  hold?: number;
}) {
  const [logoReady, setLogoReady] = useState(!business.logo);
  useEffect(() => {
    if (phase === "on") {
      if (!hold) return;
      const lift = window.setTimeout(() => onPhase("lift"), hold);
      return () => window.clearTimeout(lift);
    }
    if (phase === "lift") {
      const done = window.setTimeout(() => onPhase("off"), 720);
      return () => window.clearTimeout(done);
    }
  }, [phase, onPhase, hold]);
  if (phase === "off") return null;
  return (
    <div
      className={`bk-intro is-${phase} is-${mode}`}
      onClick={() => phase === "on" && onPhase("lift")}
      aria-hidden="true"
    >
      <div className="bk-intro-mark">
        {business.logo ? (
          <span
            className={`bk-intro-logo ${logoReady ? "is-ready" : ""}`}
            onLoadCapture={() => setLogoReady(true)}
          >
            <PublicImage src={business.logo} alt="" priority />
          </span>
        ) : (
          <span className="bk-intro-monogram">
            <span>{monogram(business.name)}</span>
          </span>
        )}
      </div>
      <span className="bk-intro-rule" />
      <strong className="bk-intro-name">{business.name}</strong>
      <small className="bk-intro-category">{business.category}</small>
    </div>
  );
}

/** Shown while the catalog loads: paper and a moving brass rule. */
export function BookingLoader() {
  return (
    <main className="bk-loader" aria-busy="true">
      <span className="bk-loader-rule" />
      <span className="bk-loader-text">Preparando sua agenda…</span>
    </main>
  );
}
