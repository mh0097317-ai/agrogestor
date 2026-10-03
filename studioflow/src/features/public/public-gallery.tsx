"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CaretLeft,
  CaretRight,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { PublicImage } from "./public-ui";

export function PublicWork({
  photos,
  businessName,
  bookHref,
}: {
  photos: string[];
  businessName: string;
  bookHref: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  const visible =
    photos.length >= 6
      ? photos.slice(0, 6)
      : photos.length >= 3
        ? photos.slice(0, 3)
        : photos;
  const hidden = photos.length - visible.length;
  return (
    <section id="trabalhos" className="pp-section">
      <div className="pp-section-head" data-reveal>
        <h2>Nossos trabalhos</h2>
        <button type="button" className="pp-see-all" onClick={() => setOpen(0)}>
          {photos.length > 1 ? `Ver as ${photos.length} fotos` : "Ampliar"}
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
      <div className={`pp-work count-${visible.length}`} data-reveal="scale">
        {visible.map((photo, index) => (
          <button
            type="button"
            key={`${index}-${photo.slice(-24)}`}
            className="pp-work-tile"
            onClick={() => setOpen(index)}
            aria-label={`Ampliar foto ${index + 1} de ${photos.length}`}
          >
            <PublicImage src={photo} alt="" className="pp-work-photo" />
            {index === visible.length - 1 && hidden > 0 && (
              <span className="pp-work-more">+{hidden}</span>
            )}
          </button>
        ))}
      </div>
      {open !== null && (
        <Lightbox
          photos={photos}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          businessName={businessName}
          bookHref={bookHref}
        />
      )}
    </section>
  );
}

function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
  businessName,
  bookHref,
}: {
  photos: string[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  businessName: string;
  bookHref: string;
}) {
  const [direction, setDirection] = useState(1);
  const closeButton = useRef<HTMLButtonElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const many = photos.length > 1;

  function go(offset: number) {
    if (!many) return;
    setDirection(offset > 0 ? 1 : -1);
    onIndex((index + offset + photos.length) % photos.length);
  }
  const goRef = useRef(go);
  const closeRef = useRef(onClose);
  useEffect(() => {
    goRef.current = go;
    closeRef.current = onClose;
  });

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "ArrowRight") goRef.current(1);
      if (event.key === "ArrowLeft") goRef.current(-1);
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    thumbs.current
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [index]);

  function pointerDown(event: PointerEvent) {
    swipe.current = { x: event.clientX, y: event.clientY };
  }
  function pointerUp(event: PointerEvent) {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
  }

  return createPortal(
    <div
      className="pp-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${businessName}`}
    >
      <div className="pp-lightbox-top">
        <span aria-live="polite">
          {index + 1} de {photos.length}
        </span>
        <button
          ref={closeButton}
          type="button"
          className="pp-lightbox-icon"
          aria-label="Fechar fotos"
          onClick={onClose}
        >
          <X size={20} weight="bold" />
        </button>
      </div>
      <div
        className="pp-lightbox-stage"
        onPointerDown={pointerDown}
        onPointerUp={pointerUp}
        onPointerCancel={() => (swipe.current = null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <img
          key={index}
          src={photos[index]}
          alt={`Foto ${index + 1} de ${photos.length} de ${businessName}`}
          className={direction > 0 ? "from-next" : "from-previous"}
          draggable={false}
        />
        {many && (
          <>
            <button
              type="button"
              className="pp-lightbox-icon pp-lightbox-nav is-previous"
              aria-label="Foto anterior"
              onClick={() => go(-1)}
            >
              <CaretLeft size={22} weight="bold" />
            </button>
            <button
              type="button"
              className="pp-lightbox-icon pp-lightbox-nav is-next"
              aria-label="Próxima foto"
              onClick={() => go(1)}
            >
              <CaretRight size={22} weight="bold" />
            </button>
          </>
        )}
      </div>
      <div className="pp-lightbox-foot">
        {many && (
          <div className="pp-lightbox-thumbs" ref={thumbs}>
            {photos.map((photo, thumb) => (
              <button
                type="button"
                key={`${thumb}-${photo.slice(-24)}`}
                aria-label={`Ver foto ${thumb + 1}`}
                aria-current={thumb === index}
                onClick={() => {
                  setDirection(thumb > index ? 1 : -1);
                  onIndex(thumb);
                }}
              >
                <img src={photo} alt="" draggable={false} />
              </button>
            ))}
          </div>
        )}
        <Link href={bookHref} className="public-button pp-lightbox-cta">
          Gostei, quero agendar <ArrowRight size={18} weight="bold" />
        </Link>
      </div>
    </div>,
    document.body,
  );
}
