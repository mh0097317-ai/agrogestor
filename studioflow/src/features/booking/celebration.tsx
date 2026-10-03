import type { CSSProperties } from "react";

const colors = ["#0D2847", "#3F7DC0", "#8CBBEA", "#F4B860", "#22C55E"];

/** Animated check with a short confetti burst, for a fresh confirmation. */
export function SuccessCheck({ celebrate }: { celebrate: boolean }) {
  return (
    <span className="success-check">
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <path d="M15 27.5l7.5 7.5L38 19" />
      </svg>
      {celebrate && (
        <span className="success-confetti" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => {
            // Deterministic spread so server and client render the same.
            const angle = (i / 22) * Math.PI * 2 + (i % 3) * 0.18;
            const distance = 70 + ((i * 37) % 60);
            return (
              <i
                key={i}
                style={
                  {
                    "--dx": `${Math.round(Math.cos(angle) * distance)}px`,
                    "--dy": `${Math.round(Math.sin(angle) * distance - 20)}px`,
                    "--rot": `${(i * 67) % 360}deg`,
                    background: colors[i % colors.length],
                    animationDelay: `${320 + (i % 5) * 30}ms`,
                    borderRadius: i % 3 === 0 ? "50%" : "2px",
                  } as CSSProperties
                }
              />
            );
          })}
        </span>
      )}
    </span>
  );
}
