"use client";

import { useEffect, useRef, useState } from "react";

export const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A copy of `from` (a service photo) flies to `to` (the bar photo) and
 * lands with a small bump: the choice visibly "goes into the bag".
 */
export function flyTo(from: Element | null, to: Element | null) {
  if (!from || !to || reducedMotion()) return;
  const start = from.getBoundingClientRect();
  const end = to.getBoundingClientRect();
  if (!start.width || !end.width || end.top > window.innerHeight) return;
  const ghost = from.cloneNode(true) as HTMLElement;
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${start.left}px`,
    top: `${start.top}px`,
    width: `${start.width}px`,
    height: `${start.height}px`,
    margin: "0",
    zIndex: "60",
    pointerEvents: "none",
    borderRadius: "3px",
    overflow: "hidden",
  });
  ghost.setAttribute("aria-hidden", "true");
  document.body.appendChild(ghost);
  const dx = end.left + end.width / 2 - (start.left + start.width / 2);
  const dy = end.top + end.height / 2 - (start.top + start.height / 2);
  const scale = end.width / start.width;
  const flight = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      {
        transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 40}px) scale(${(1 + scale) / 2}) rotate(-4deg)`,
        opacity: 1,
        offset: 0.55,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
        opacity: 0.2,
      },
    ],
    { duration: 620, easing: "cubic-bezier(.5,0,.25,1)" },
  );
  flight.onfinish = () => {
    ghost.remove();
    to.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.14)" },
        { transform: "scale(1)" },
      ],
      { duration: 320, easing: "cubic-bezier(.34,1.56,.64,1)" },
    );
  };
}

/** A money value that rolls to its new amount instead of jumping. */
export function RollingMoney({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    if (reducedMotion()) {
      from.current = value;
      const frame = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(frame);
    }
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / 480);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (value - start) * eased;
      from.current = current;
      setShown(current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span className="bk-rolling">
      {new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Math.round(shown * 100) / 100)}
    </span>
  );
}

/**
 * Swipe right on the step to go back, like a native app. The screen
 * follows the finger a little so the gesture feels physical.
 */
export function useSwipeBack(onBack?: () => void) {
  const start = useRef<{ x: number; y: number; target: HTMLElement } | null>(
    null,
  );
  if (!onBack) return {};
  return {
    onTouchStart(event: React.TouchEvent<HTMLElement>) {
      const touch = event.touches[0];
      // The screen edge belongs to the system "back" gesture.
      if (touch.clientX < 24) return;
      // Leave horizontal scrollers (tabs, chips) alone.
      if ((event.target as HTMLElement).closest(".bk-tabs, input, textarea"))
        return;
      start.current = {
        x: touch.clientX,
        y: touch.clientY,
        target: event.currentTarget,
      };
    },
    onTouchMove(event: React.TouchEvent<HTMLElement>) {
      if (!start.current) return;
      const touch = event.touches[0];
      const dx = touch.clientX - start.current.x;
      const dy = Math.abs(touch.clientY - start.current.y);
      if (dy > 40) {
        start.current.target.style.removeProperty("--swipe");
        start.current = null;
        return;
      }
      if (dx > 0 && !reducedMotion())
        start.current.target.style.setProperty(
          "--swipe",
          `${Math.min(36, dx * 0.25)}px`,
        );
    },
    onTouchEnd(event: React.TouchEvent<HTMLElement>) {
      if (!start.current) return;
      const dx = event.changedTouches[0].clientX - start.current.x;
      start.current.target.style.removeProperty("--swipe");
      start.current = null;
      if (dx > 90) onBack();
    },
  };
}
