"use client";

import { useEffect, useState } from "react";
import type { Business, Service } from "@/types";
import type { PublicProfessional } from "@/features/public/types";
import { durationLabel, money, monogram } from "@/lib/utils";
import { reducedMotion } from "./motion";
import { servicesSummary } from "./booking-summary";
import { bookingDateShort, bookingTime } from "./date-format";

const buzz = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not every phone lets the page vibrate.
  }
};

/**
 * The booking as a printed ticket. On a fresh booking a pair of scissors
 * runs along the perforation and the stub comes loose, with a light buzz
 * on phones that allow it. Later visits show it already cut.
 */
export function BookingTicket({
  business,
  customerName,
  services,
  professional,
  start,
  end,
  code,
  totalPrice,
  animate,
}: {
  business: Business;
  customerName: string;
  services: Service[];
  professional?: PublicProfessional;
  start: string;
  end: string;
  code: string;
  totalPrice?: number;
  animate: boolean;
}) {
  const [cutting] = useState(() => animate && !reducedMotion());
  useEffect(() => {
    if (!cutting) return;
    const snips = window.setTimeout(
      () => buzz([8, 70, 8, 70, 8, 70, 8]),
      1250,
    );
    const loose = window.setTimeout(() => buzz(28), 2350);
    return () => {
      window.clearTimeout(snips);
      window.clearTimeout(loose);
    };
  }, [cutting]);
  const summary = servicesSummary(services);
  const first = customerName.trim().split(/\s+/)[0];
  return (
    <article
      className={`bk-ticket ${cutting ? "is-cutting" : ""}`}
      aria-label={`Ticket do seu horário na ${business.name}`}
    >
      <div className="bk-ticket-main">
        <header className="bk-ticket-brand">
          <span className="bk-ticket-logo">
            {business.logo ? (
              <img src={business.logo} alt="" />
            ) : (
              monogram(business.name)
            )}
          </span>
          <span>
            <small>Ticket de atendimento</small>
            <strong>{business.name}</strong>
          </span>
        </header>
        <p className="bk-ticket-for">
          <small>Reservado para</small>
          <strong>{first}</strong>
        </p>
        <p className="bk-ticket-service">
          {summary.name}
          <span>
            {durationLabel(summary.duration)} ·{" "}
            {money(totalPrice ?? summary.price)}
          </span>
        </p>
        <dl className="bk-ticket-grid">
          <div>
            <dt>Data</dt>
            <dd>{bookingDateShort(start)}</dd>
          </div>
          <div>
            <dt>Horário</dt>
            <dd>
              {bookingTime(start)}–{bookingTime(end)}
            </dd>
          </div>
          <div>
            <dt>Com</dt>
            <dd>{professional?.name.split(" ")[0] || "Equipe"}</dd>
          </div>
        </dl>
      </div>
      <div className="bk-ticket-tear" aria-hidden="true">
        <span className="bk-ticket-scissors">
          <svg viewBox="0 0 44 24">
            <g className="bk-ticket-blade is-top">
              <path d="M21 12 L43 10.6 Q33 7.4 21 9.4 Z" />
              <path d="M21 10.6 L12.5 6.8" />
              <circle cx="8" cy="5.5" r="4.6" />
            </g>
            <g className="bk-ticket-blade is-bottom">
              <path d="M21 12 L43 13.4 Q33 16.6 21 14.6 Z" />
              <path d="M21 13.4 L12.5 17.2" />
              <circle cx="8" cy="18.5" r="4.6" />
            </g>
            <circle cx="21" cy="12" r="1.5" className="bk-ticket-pin" />
          </svg>
        </span>
      </div>
      <div className="bk-ticket-stub">
        <span>
          <small>Mostre na recepção</small>
          <strong>#{code}</strong>
        </span>
        <time dateTime={start}>{bookingTime(start)}</time>
      </div>
    </article>
  );
}
