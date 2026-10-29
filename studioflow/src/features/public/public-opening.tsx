"use client";

import { useLayoutEffect, useRef } from "react";
import { monogram } from "@/lib/utils";
import type { Business } from "@/types";
import { openingSessionKey, markIntroSeen } from "@/lib/booking-intro-visit";
import { StudioFlowOpening } from "@/components/studioflow-opening";

const seenKey = openingSessionKey;

/**
 * First visit of the session: the house sign fills the screen and then
 * opens like two doors onto the page. Pure CSS, painted with the server
 * HTML; a tiny inline script hides it before paint on later visits.
 * Tap to skip; never with reduced motion.
 */
export function PublicOpening({ business }: { business: Business }) {
  const decided = useRef(false);
  // Client-side visits (no inline script ran): decide before paint.
  useLayoutEffect(() => {
    if (decided.current) return;
    decided.current = true;
    try {
      if (sessionStorage.getItem(seenKey))
        document.documentElement.setAttribute("data-pp-seen", "");
      markIntroSeen(business.slug);
    } catch {
      // Without storage it may play again next time.
    }
  }, [business.slug]);
  const half = (
    <div className="pp-opening-sign">
      <span className="pp-opening-mark">
        {business.logo ? (
          <img src={business.logo} alt="" />
        ) : (
          monogram(business.name)
        )}
      </span>
      <span className="pp-opening-name">
        <strong>{business.name}</strong>
        <small>{business.category}</small>
      </span>
    </div>
  );
  return (
    <>
      <script
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        // Runs while the HTML is parsed, before the curtain is painted.
        dangerouslySetInnerHTML={{
          __html: `try{sessionStorage.getItem("${seenKey}")&&document.documentElement.setAttribute("data-pp-seen","")}catch(e){}`,
        }}
      />
      <div
        className="pp-opening sf-opening"
        onClick={(event) => event.currentTarget.classList.add("is-skipped")}
      >
        <StudioFlowOpening />
        <div className="pp-opening-door is-top" aria-hidden="true">
          {half}
        </div>
        <div className="pp-opening-door is-bottom" aria-hidden="true">
          {half}
        </div>
        <button type="button" className="sf-opening-skip">
          Pular abertura <span aria-hidden="true">↗</span>
        </button>
      </div>
    </>
  );
}
