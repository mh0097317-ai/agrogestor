"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import "./photo-scrub.css";

/**
 * Up to 3 photos in one frame. Moving the mouse across it (or sliding a
 * finger sideways) shows the next ones with a crossfade; the thin bars at
 * the bottom say how many there are. With one photo it is a plain picture.
 */
export function PhotoScrub({
  photos,
  alt,
  className = "",
  fallback,
  label,
}: {
  photos: string[];
  alt: string;
  className?: string;
  /** Shown when there is no photo or it fails to load. */
  fallback?: ReactNode;
  /** Accessible name for the frame when it has several photos. */
  label?: string;
}) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<string[]>([]);
  const touch = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const list = photos.filter((photo) => !failed.includes(photo));
  const many = list.length > 1;
  const current = Math.min(active, Math.max(list.length - 1, 0));

  useEffect(() => () => clearTimeout(settle.current), []);

  function pick(event: PointerEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const share = (event.clientX - box.left) / Math.max(box.width, 1);
    setActive(Math.min(list.length - 1, Math.max(0, Math.floor(share * list.length))));
  }
  function move(event: PointerEvent<HTMLElement>) {
    if (!many) return;
    if (event.pointerType === "mouse") return pick(event);
    const start = touch.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) start.moved = true;
    if (start.moved) pick(event);
  }

  if (!list.length)
    return <span className={`photo-scrub is-empty ${className}`}>{fallback}</span>;

  return (
    <span
      className={`photo-scrub ${many ? "is-many" : ""} ${className}`}
      role={many ? "img" : undefined}
      aria-label={many ? label || `${alt}: ${list.length} fotos` : undefined}
      onPointerMove={move}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setActive(0);
      }}
      onPointerDown={(event) => {
        if (!many || event.pointerType === "mouse") return;
        clearTimeout(settle.current);
        touch.current = { x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerUp={() => {
        if (touch.current?.moved)
          // Back to the main photo a moment after the finger leaves.
          settle.current = setTimeout(() => setActive(0), 2400);
      }}
      onPointerCancel={() => (touch.current = null)}
      onClickCapture={(event) => {
        // A sideways slide only browses the photos; it does not tap the row.
        if (touch.current?.moved) {
          event.preventDefault();
          event.stopPropagation();
        }
        touch.current = null;
      }}
    >
      {list.map((photo, index) => (
        <img
          key={photo}
          src={photo}
          alt={index === 0 && !many ? alt : ""}
          loading="lazy"
          draggable={false}
          className={`${index === current ? "is-active" : ""} ${loaded.includes(photo) ? "is-loaded" : ""}`}
          onLoad={() => setLoaded((items) => [...items, photo])}
          onError={() => setFailed((items) => [...items, photo])}
        />
      ))}
      {many && (
        <span className="photo-scrub-bars" aria-hidden="true">
          {list.map((photo, index) => (
            <i key={photo} className={index === current ? "is-on" : ""} />
          ))}
        </span>
      )}
    </span>
  );
}
