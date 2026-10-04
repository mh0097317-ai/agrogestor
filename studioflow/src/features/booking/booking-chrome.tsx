"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { DrawCheck } from "./draw-check";
import type { Business } from "@/types";
import { PublicImage } from "@/features/public/public-ui";
import { publicAccentStyle } from "@/features/public/public-branding";
import "@/features/public/public.css";
import "./booking.css";

export const bookingSteps = [
  "Serviço",
  "Profissional",
  "Horário",
  "Dados",
  "Pronto",
];

/**
 * Numbered steps. Step 6 means the booking exists: every step, "Pronto"
 * included, shows as done.
 */
export function BookingProgress({
  step,
  onStep,
}: {
  step: number;
  onStep?: (step: number) => void;
}) {
  return (
    <nav className="bk-steps" aria-label="Etapas do agendamento">
      <ol>
        {bookingSteps.map((label, index) => {
          const number = index + 1;
          const done = number < step || step > bookingSteps.length;
          const current = number === step;
          return (
            <li
              key={label}
              className={`${done ? "is-done" : ""} ${current ? "is-current" : ""}`}
            >
              <button
                type="button"
                onClick={() => onStep?.(number)}
                disabled={!onStep || !done || step > bookingSteps.length}
                aria-current={current ? "step" : undefined}
                aria-label={`${label}${done ? ", concluído" : current ? ", etapa atual" : ""}`}
              >
                <span className="bk-step-dot">
                  {done ? <DrawCheck size={14} /> : number}
                </span>
                <small>{label}</small>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** White header with the business identity and the steps. */
export function BookingChrome({
  business,
  step,
  onBack,
  onStep,
  backDisabled = false,
  children,
  after,
}: {
  business: Business;
  step: number;
  /** Step back inside the flow; without it the arrow returns to the page. */
  onBack?: () => void;
  onStep?: (step: number) => void;
  backDisabled?: boolean;
  children: ReactNode;
  after?: ReactNode;
}) {
  return (
    <div className="booking-site bk" style={publicAccentStyle(business.color)}>
      <header className="bk-top">
        <div className="bk-top-row">
          {onBack ? (
            <button
              type="button"
              className="bk-back"
              onClick={onBack}
              disabled={backDisabled}
              aria-label="Voltar uma etapa"
            >
              <ArrowLeft weight="bold" size={20} />
            </button>
          ) : (
            <Link
              href={`/${business.slug}`}
              className="bk-back"
              aria-label="Voltar ao estabelecimento"
            >
              <ArrowLeft weight="bold" size={20} />
            </Link>
          )}
          <Link href={`/${business.slug}`} className="bk-brand">
            <PublicImage
              src={business.logo}
              alt=""
              className={`bk-brand-mark ${business.logo ? "has-logo" : ""}`}
              segment={business.category}
            />
            <span>
              <strong>{business.name}</strong>
              <small>Agendamento online</small>
            </span>
          </Link>
        </div>
        <BookingProgress step={step} onStep={onStep} />
      </header>
      <main className="bk-main">{children}</main>
      {after}
    </div>
  );
}
