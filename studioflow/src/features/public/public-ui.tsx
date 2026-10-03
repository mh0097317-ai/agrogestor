"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CircleNotch,
  Scissors,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { initials } from "@/lib/utils";

export function PublicImage({
  src,
  alt,
  className = "",
  fallbackName,
  priority = false,
  segment,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallbackName?: string;
  priority?: boolean;
  segment?: string;
}) {
  const [failed, setFailed] = useState(false);
  const FallbackIcon =
    !segment || /barbe|cabelo|cabele|salão/i.test(segment) ? Scissors : Sparkle;
  return (
    <span className={`public-image ${className}`}>
      {src && !failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 640px) 100vw, 800px"
          unoptimized
          priority={priority}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="public-image-fallback">
          {fallbackName ? initials(fallbackName) : <FallbackIcon size={28} />}
        </span>
      )}
    </span>
  );
}

export function PublicLoading() {
  return (
    <main
      className="public-load"
      aria-busy="true"
      aria-label="Carregando estabelecimento"
    >
      <div className="public-skeleton public-skeleton-cover" />
      <div className="public-skeleton public-skeleton-title" />
      <div className="public-skeleton public-skeleton-line" />
      <div className="public-skeleton public-skeleton-button" />
      <div className="public-skeleton-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="public-skeleton public-skeleton-card" />
        ))}
      </div>
      <span className="public-sr-only">Carregando…</span>
    </main>
  );
}

export function PublicError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <main className="public-error-page">
      <Scissors weight="duotone" size={36} />
      <h1>Vamos tentar de novo?</h1>
      <p>{message}</p>
      <button className="public-button" onClick={retry}>
        Tentar novamente
      </button>
      <Link href="/" className="public-text-link">
        Voltar ao início
      </Link>
    </main>
  );
}

export function BookingHeader({
  slug,
  businessName,
  onBack,
  canBack,
  busy = false,
}: {
  slug: string;
  businessName: string;
  onBack?: () => void;
  canBack?: boolean;
  busy?: boolean;
}) {
  return (
    <header className="booking-header">
      <div className="booking-header-inner">
        {canBack ? (
          <button
            className="public-icon-button"
            onClick={onBack}
            disabled={busy}
            aria-label="Voltar uma etapa"
          >
            <ArrowLeft weight="bold" size={20} />
          </button>
        ) : (
          <Link
            href={`/${slug}`}
            className="public-icon-button"
            aria-label="Voltar ao estabelecimento"
          >
            <ArrowLeft weight="bold" size={20} />
          </Link>
        )}
        <Link href={`/${slug}`} className="booking-business-title">
          <span className="booking-brand-mark">
            <Scissors weight="duotone" size={19} />
          </span>
          <span>
            {businessName}
            <small>Agendamento online</small>
          </span>
        </Link>
        <span className="booking-safe">
          <ShieldCheck weight="duotone" size={16} /> Seguro e simples
        </span>
      </div>
    </header>
  );
}

export function PublicRefreshNotice({
  error,
  refreshing,
  retry,
}: {
  error?: string;
  refreshing?: boolean;
  retry: () => void;
}) {
  if (!error && !refreshing) return null;
  return (
    <div className="public-refresh-notice" role={error ? "alert" : "status"}>
      {refreshing ? (
        <>
          <CircleNotch weight="bold" size={16} className="public-spin" />
          <span>Atualizando informações…</span>
        </>
      ) : (
        <>
          <span>{error}</span>
          <button className="public-text-link" onClick={retry}>
            Tentar novamente
          </button>
        </>
      )}
    </div>
  );
}

export function BusyButton({
  children,
  busy,
  disabled,
  onClick,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={busy || disabled}
      onClick={onClick}
      className={`public-button ${className}`}
    >
      {busy ? (
        <CircleNotch weight="bold" size={18} className="public-spin" />
      ) : (
        children
      )}
    </button>
  );
}
