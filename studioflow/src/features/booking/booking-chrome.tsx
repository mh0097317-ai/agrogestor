"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Business } from "@/types";
import { PublicImage } from "@/features/public/public-ui";
import { publicAccentStyle } from "@/features/public/public-branding";

/** Cover, floating top bar and the white sheet shared by booking screens. */
export function BookingChrome({
  business,
  onBack,
  backDisabled = false,
  children,
  after,
}: {
  business: Business;
  /** Step back inside the flow; without it the arrow returns to the page. */
  onBack?: () => void;
  backDisabled?: boolean;
  children: ReactNode;
  after?: ReactNode;
}) {
  return (
    <div className="booking-site bk" style={publicAccentStyle(business.color)}>
      <div className="bk-topbar">
        <div className="bk-topbar-inner">
          {onBack ? (
            <button
              type="button"
              className="bk-round"
              onClick={onBack}
              disabled={backDisabled}
              aria-label="Voltar uma etapa"
            >
              <ArrowLeft weight="bold" size={19} />
            </button>
          ) : (
            <Link
              href={`/${business.slug}`}
              className="bk-round"
              aria-label="Voltar ao estabelecimento"
            >
              <ArrowLeft weight="bold" size={19} />
            </Link>
          )}
          <Link href={`/${business.slug}`} className="bk-brand">
            <PublicImage
              src={business.logo || business.cover}
              alt=""
              className="bk-brand-photo"
              segment={business.category}
            />
            <span>
              <strong>{business.name}</strong>
              <small>{business.category}</small>
            </span>
          </Link>
        </div>
      </div>
      <header className="bk-hero" aria-hidden="true">
        {business.cover && (
          <PublicImage
            src={business.cover}
            alt=""
            className="bk-hero-photo"
            priority
          />
        )}
        <span className="bk-hero-shade" />
      </header>
      <main className="bk-sheet">{children}</main>
      {after}
    </div>
  );
}
