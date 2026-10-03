import { useId } from "react";

/**
 * StudioFlow mark: a two-tone geometric "S" (two arches) with a spark.
 * Kept in sync with public/icon.svg, which is the source for the PWA icons.
 */
export function BrandLogo({
  size = 36,
  animated = false,
  className = "",
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
      className={`brand-logo ${size < 64 ? "is-small" : ""} ${animated ? "is-animated" : ""} ${className}`}
    >
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#091729" />
          <stop offset=".55" stopColor="#0D2847" />
          <stop offset="1" stopColor="#1B5288" />
        </linearGradient>
        <radialGradient id={`${id}glow`} cx=".28" cy=".18" r=".8">
          <stop offset="0" stopColor="#fff" stopOpacity=".1" />
          <stop offset=".6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#D3E4F6" />
        </linearGradient>
        <linearGradient id={`${id}bottom`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8CBBEA" />
          <stop offset="1" stopColor="#3F7DC0" />
        </linearGradient>
        <filter id={`${id}lift`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow
            dx="0"
            dy="8"
            stdDeviation="9"
            floodColor="#030b16"
            floodOpacity=".35"
          />
        </filter>
      </defs>
      <rect width="512" height="512" rx="120" fill={`url(#${id}bg)`} />
      <rect width="512" height="512" rx="120" fill={`url(#${id}glow)`} />
      <path
        className="brand-arch brand-arch-bottom"
        d="M160 316 A 96 96 0 0 0 352 316 A 96 96 0 0 0 256 220 L 256 276 A 40 40 0 0 1 296 316 A 40 40 0 0 1 216 316 Z"
        fill={`url(#${id}bottom)`}
      />
      <path
        className="brand-arch brand-arch-top"
        filter={`url(#${id}lift)`}
        d="M352 196 A 96 96 0 0 0 160 196 A 96 96 0 0 0 256 292 L 256 236 A 40 40 0 0 1 216 196 A 40 40 0 0 1 296 196 Z"
        fill={`url(#${id}top)`}
      />
      <path
        className="brand-spark"
        d="M394 100 Q399 130 428 135 Q399 140 394 170 Q389 140 360 135 Q389 130 394 100Z"
        fill="#fff"
      />
    </svg>
  );
}

/** Logo plus "studioflow" wordmark; tone is the ground it sits on. */
export function Brand({
  size = 34,
  tone = "on-light",
  animated = false,
  className = "",
}: {
  size?: number;
  tone?: "on-light" | "on-dark";
  animated?: boolean;
  className?: string;
}) {
  return (
    <span className={`brand-lockup ${tone} ${className}`}>
      <BrandLogo size={size} animated={animated} />
      <span className="brand-lockup-text">
        studio<b>flow</b>
      </span>
    </span>
  );
}
