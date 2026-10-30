"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Chair } from "./salon-model";
import type { SalonScene } from "./salon-3d-scene";

/**
 * The live salon in real 3D (three.js, loaded only here). Labels are HTML
 * placed over each chair; when WebGL is missing the drawn room is shown.
 */
export function Salon3D({
  chairs,
  waiting,
  shopName,
  category,
  selected,
  onSelect,
  label,
  fallback,
}: {
  chairs: Chair[];
  waiting: number;
  shopName: string;
  category: string;
  selected: string;
  onSelect: (id: string) => void;
  label: (chair: Chair, index: number) => ReactNode;
  fallback: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<SalonScene | null>(null);
  const tags = useRef(new Map<string, HTMLDivElement>());
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const shown = chairs.slice(0, 8);
  const states = shown.map((c) => `${c.professional.id}:${c.state}`).join("|");
  const latest = useRef({ shown, waiting, onSelect, selected });
  useEffect(() => {
    latest.current = { shown, waiting, onSelect, selected };
  });

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    const observer = new ResizeObserver(() => scene.current?.resize());
    observer.observe(element);
    void import("./salon-3d-scene")
      .then(({ createSalonScene }) => {
        if (disposed) return;
        const now = latest.current;
        scene.current = createSalonScene({
          canvas: element,
          shopName,
          category,
          chairs: now.shown.map((c) => ({
            id: c.professional.id,
            state: c.state,
          })),
          waiting: now.waiting,
          onSelect: (id) => latest.current.onSelect(id),
          onAnchors: (anchors) => {
            for (const a of anchors) {
              const tag = tags.current.get(a.id);
              if (!tag) continue;
              tag.style.transform = `translate(${a.x}px, ${a.y}px) translate(-50%, -100%)`;
              tag.style.visibility = a.visible ? "visible" : "hidden";
            }
          },
        });
        scene.current.select(now.selected);
        setReady(true);
      })
      .catch(() => !disposed && setFailed(true));
    return () => {
      disposed = true;
      observer.disconnect();
      scene.current?.dispose();
      scene.current = null;
    };
    // The room is rebuilt only when its shape changes.
  }, [shopName, category, shown.length]);

  useEffect(() => {
    scene.current?.update(
      latest.current.shown.map((c) => ({
        id: c.professional.id,
        state: c.state,
      })),
      waiting,
    );
  }, [states, waiting, ready]);
  useEffect(() => {
    scene.current?.select(selected);
  }, [selected, ready]);

  if (failed) return <>{fallback}</>;
  return (
    <div className={`sl-3d ${ready ? "is-ready" : ""}`}>
      <canvas ref={canvas} aria-hidden="true" />
      {shown.map((chair, i) => (
        <div
          key={chair.professional.id}
          className="sl-3d-tag"
          ref={(node) => {
            if (node) tags.current.set(chair.professional.id, node);
            else tags.current.delete(chair.professional.id);
          }}
        >
          {label(chair, i)}
        </div>
      ))}
      {!ready && <span className="sl-3d-loading">Montando o salão…</span>}
    </div>
  );
}
