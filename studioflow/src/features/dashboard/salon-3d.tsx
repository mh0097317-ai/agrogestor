"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import type { Chair } from "./salon-model";
import type { SalonArea, SalonScene } from "./salon-3d-scene";

type View = "3d" | "2d";
const viewKey = "studioflow:salon-view";
const viewListeners = new Set<() => void>();
function readView(): View {
  try {
    const saved = localStorage.getItem(viewKey);
    if (saved === "3d" || saved === "2d") return saved;
  } catch {}
  return "3d";
}
function subscribeView(listener: () => void) {
  viewListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    viewListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
function saveView(view: View) {
  try {
    localStorage.setItem(viewKey, view);
  } catch {}
  viewListeners.forEach((listener) => listener());
}

/**
 * The live salon in real 3D (three.js, loaded only here). Labels are HTML
 * placed over each chair; the drawn room stays as the flat view and as the
 * fallback when WebGL is missing or lost.
 */
export function Salon3D({
  chairs,
  waiting,
  shopName,
  category,
  selected,
  onSelect,
  onArea,
  label,
  areas,
  fallback,
}: {
  chairs: Chair[];
  waiting: number;
  shopName: string;
  category: string;
  selected: string;
  onSelect: (id: string) => void;
  onArea: (area: SalonArea) => void;
  label: (chair: Chair, index: number) => ReactNode;
  areas: Record<SalonArea, ReactNode>;
  fallback: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<SalonScene | null>(null);
  const tags = useRef(new Map<string, HTMLDivElement>());
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const view = useSyncExternalStore(subscribeView, readView, () => "3d");
  const flat = failed || view === "2d";
  const shown = chairs.slice(0, 8);
  const states = shown.map((c) => `${c.professional.id}:${c.state}`).join("|");
  const latest = useRef({ shown, waiting, onSelect, onArea, selected });
  useEffect(() => {
    latest.current = { shown, waiting, onSelect, onArea, selected };
  });

  useEffect(() => {
    const element = canvas.current;
    if (flat || !element) return;
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
          onArea: (area) => latest.current.onArea(area),
          onFailure: () => !disposed && setFailed(true),
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
      setReady(false);
    };
    // The room is rebuilt only when its shape changes.
  }, [flat, shopName, category, shown.length]);

  useEffect(() => {
    scene.current?.update(
      latest.current.shown.map((c) => ({
        id: c.professional.id,
        state: c.state,
      })),
      waiting,
    );
  }, [states, waiting, ready]);
  // Glide to a chair the owner picks; the first selection only highlights.
  const focused = useRef(false);
  useEffect(() => {
    if (!ready) return;
    scene.current?.select(selected, focused.current);
    focused.current = true;
  }, [selected, ready]);

  const toolbar = (
    <div className="sl-3d-tools">
      {!failed && (
        <div className="sl-3d-view" role="group" aria-label="Visualização">
          {(["3d", "2d"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => saveView(v)}
            >
              {v === "3d" ? "3D" : "Planta"}
            </button>
          ))}
        </div>
      )}
      {!flat && ready && (
        <>
          <button
            type="button"
            className="sl-3d-reset"
            onClick={() => scene.current?.resetCamera()}
          >
            <ArrowsClockwise size={14} weight="bold" /> Centralizar
          </button>
          <span className="sl-3d-hint">Arraste para girar · role para aproximar</span>
        </>
      )}
    </div>
  );
  if (flat)
    return (
      <>
        {fallback}
        {toolbar}
      </>
    );
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
      {(Object.keys(areas) as SalonArea[]).map((area) => (
        <div
          key={area}
          className="sl-3d-tag is-area"
          ref={(node) => {
            if (node) tags.current.set(area, node);
            else tags.current.delete(area);
          }}
        >
          {areas[area]}
        </div>
      ))}
      {!ready && <span className="sl-3d-loading">Montando o salão…</span>}
      {toolbar}
    </div>
  );
}
