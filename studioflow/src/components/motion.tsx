"use client";
import { useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Reveals every [data-reveal] element as it scrolls into view, including
 * elements rendered later (data loaded on the client). Mounted once.
 */
export function MotionProvider() {
  useEffect(() => {
    const root = document.documentElement;
    if (typeof IntersectionObserver === "undefined") return;
    root.classList.add("motion-ready");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const scan = () =>
      document
        .querySelectorAll("[data-reveal]:not(.is-visible)")
        .forEach((element) => io.observe(element));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      root.classList.remove("motion-ready");
    };
  }, []);
  return null;
}

const rippleTargets =
  ".btn, .public-button, .ov-quick, .ov-now-primary, .nav-link, .bottom-nav a, .image-action, .management-tab, .bk-service, .bk-pro, .booking-slot-grid > button, .booking-day-strip button";
const spotlightTargets =
  ".ov-card, .ov-kpi, .metric-item, .team-card, .catalog-list";

/**
 * Touch feedback (ripple from the pressed point) and a soft light that
 * follows the pointer on panel cards. Mounted once.
 */
export function PointerEffects() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    function press(event: PointerEvent) {
      const target = (event.target as Element | null)?.closest<HTMLElement>(
        rippleTargets,
      );
      if (!target || (target as HTMLButtonElement).disabled) return;
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.6;
      const ripple = document.createElement("span");
      ripple.className = "sf-ripple";
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      target.classList.add("sf-ripple-host");
      target.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), {
        once: true,
      });
    }
    let frame = 0;
    function move(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const card = (event.target as Element | null)?.closest<HTMLElement>(
          spotlightTargets,
        );
        if (!card) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        card.style.setProperty("--my", `${event.clientY - rect.top}px`);
      });
    }
    document.addEventListener("pointerdown", press, { passive: true });
    document.addEventListener("pointermove", move, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", press);
      document.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}

/** Animates a number from its previous value to the new one. */
export function CountUp({
  value,
  format = (n) => Math.round(n).toString(),
  duration = 900,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    const total = prefersReducedMotion() ? 0 : duration;
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = total ? Math.min(1, (now - start) / total) : 1;
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(origin + (value - origin) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <>{format(shown)}</>;
}
