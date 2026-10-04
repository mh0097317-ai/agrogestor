/** A check mark that draws itself when it appears. */
export function DrawCheck({ size = 13 }: { size?: number }) {
  return (
    <svg
      className="bk-draw-check"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
