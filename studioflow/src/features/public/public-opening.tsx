"use client";

import { useLayoutEffect, useRef } from "react";
import { monogram } from "@/lib/utils";
import type { Business } from "@/types";

const seenKey = "studioflow:opening";

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
      sessionStorage.setItem(seenKey, "1");
    } catch {
      // Without storage it may play again next time.
    }
  }, []);
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
        // Runs while the HTML is parsed, before the curtain is painted.
        dangerouslySetInnerHTML={{
          __html: `try{sessionStorage.getItem("${seenKey}")&&document.documentElement.setAttribute("data-pp-seen","")}catch(e){}`,
        }}
      />
      <div
        className="pp-opening"
        aria-hidden="true"
        onClick={(event) => event.currentTarget.classList.add("is-skipped")}
      >
        <div className="pp-opening-door is-top">{half}</div>
        <div className="pp-opening-door is-bottom">{half}</div>
      </div>
    </>
  );
}
