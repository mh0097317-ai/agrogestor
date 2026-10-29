"use client";

import { useEffect, useState } from "react";
import type { Business } from "@/types";
import { PublicImage } from "@/features/public/public-ui";
import { monogram } from "@/lib/utils";
import { BrandLogo } from "@/components/brand";
import { StudioFlowOpening } from "@/components/studioflow-opening";
export { shouldPlayIntro, markIntroSeen } from "@/lib/booking-intro-visit";
import "@/features/public/public.css";
import "./booking.css";

export type IntroPhase = "on" | "lift" | "off";

/**
 * Opening of the booking: the business mark on paper, a brass rule drawn
 * under it, the name, then the paper lifts like a curtain. Tap to skip.
 */
export function BookingIntro({
  business,
  phase,
  onPhase,
  mode = "full",
  hold = 1650,
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
    >
      <div className="bk-intro-art" aria-hidden="true">
        {mode === "full" && <StudioFlowOpening />}
        {/* Poster corners, drawn in from the edges */}
        <span className="bk-intro-corner is-tl" />
        <span className="bk-intro-corner is-tr" />
        <span className="bk-intro-corner is-bl" />
        <span className="bk-intro-corner is-br" />
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
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle
                  className="is-outer"
                  cx="60"
                  cy="60"
                  r="58"
                  pathLength={1}
                />
                <circle
                  className="is-inner"
                  cx="60"
                  cy="60"
                  r="51"
                  pathLength={1}
                />
              </svg>
              <span>{monogram(business.name)}</span>
            </span>
          )}
        </div>
        <span className="bk-intro-rule" />
        <strong className="bk-intro-name" aria-label={business.name}>
          {[...business.name].map((letter, index) => (
            <span key={index} style={{ "--i": index } as React.CSSProperties}>
              {letter === " " ? "\u00a0" : letter}
            </span>
          ))}
        </strong>
        <small className="bk-intro-category">{business.category}</small>
      </div>
      {phase === "on" && (
        <button type="button" className="sf-opening-skip">
          Pular abertura <span aria-hidden="true">↗</span>
        </button>
      )}
    </div>
  );
}

/** Shown while the catalog loads: paper and a moving brass rule. */
export function BookingLoader() {
  return (
    <main className="bk-loader" aria-busy="true">
      <BrandLogo size={38} />
      <span className="bk-loader-rule" />
      <span className="bk-loader-text">Preparando sua agenda…</span>
      <small className="sf-loading-credit">Agendamento por StudioFlow</small>
    </main>
  );
}
