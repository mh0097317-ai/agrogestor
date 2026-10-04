"use client";

import { useId } from "react";
import type { Business } from "@/types";
import { monogram } from "@/lib/utils";

/**
 * Rubber stamp pressed on the receipt: the business mark in the middle,
 * the status written around it. Animated only for a fresh booking.
 */
export function ConfirmStamp({
  business,
  label,
  animate,
}: {
  business: Business;
  label: string;
  animate: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ring = `${label} · ${business.name} · `.toUpperCase();
  return (
    <div
      className={`bk-stamp ${animate ? "is-stamping" : ""}`}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <defs>
          <path
            id={`${id}ring`}
            d="M80,80 m-62,0 a62,62 0 1,1 124,0 a62,62 0 1,1 -124,0"
          />
        </defs>
        <circle cx="80" cy="80" r="76" className="bk-stamp-line" />
        <circle cx="80" cy="80" r="49" className="bk-stamp-line is-thin" />
        <text className="bk-stamp-text">
          <textPath href={`#${id}ring`} textLength="388" lengthAdjust="spacing">
            {ring}
          </textPath>
        </text>
      </svg>
      <span className="bk-stamp-center">
        {business.logo ? (
          <img src={business.logo} alt="" />
        ) : (
          <span>{monogram(business.name)}</span>
        )}
      </span>
    </div>
  );
}
