/**
 * StudioFlow mark: a geometric "S" (two arches) in paper and brass on ink.
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
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
      className={`brand-logo ${size < 64 ? "is-small" : ""} ${animated ? "is-animated" : ""} ${className}`}
    >
      <rect width="512" height="512" rx="120" fill="#16130F" />
      <path
        className="brand-arch brand-arch-bottom"
        d="M160 316 A 96 96 0 0 0 352 316 A 96 96 0 0 0 256 220 L 256 276 A 40 40 0 0 1 296 316 A 40 40 0 0 1 216 316 Z"
        fill="#B08A4E"
      />
      <path
        className="brand-arch brand-arch-top"
        d="M352 196 A 96 96 0 0 0 160 196 A 96 96 0 0 0 256 292 L 256 236 A 40 40 0 0 1 216 196 A 40 40 0 0 1 296 196 Z"
        fill="#F4F0E8"
      />
      <circle className="brand-spark" cx="388" cy="138" r="20" fill="#B08A4E" />
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
        Studio<b>Flow</b>
      </span>
    </span>
  );
}
