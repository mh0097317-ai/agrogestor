"use client";

import { useEffect, useRef } from "react";

export function PublicModal({
  children,
  labelId,
  onClose,
  busy,
  variant,
}: {
  children: React.ReactNode;
  labelId: string;
  onClose: () => void;
  busy?: boolean;
  /** "sheet": rises from the bottom on phones, a wider panel on computers. */
  variant?: "sheet";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  }, [onClose, busy]);
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function controls() {
      return Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
        ) || [],
      );
    }
    controls()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key !== "Tab") return;
      const elements = controls();
      if (!elements.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === elements[0]) {
        event.preventDefault();
        elements.at(-1)?.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === elements.at(-1)
      ) {
        event.preventDefault();
        elements[0].focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  return (
    <div
      className={`public-modal-backdrop ${variant === "sheet" ? "is-sheet" : ""}`}
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        ref={panelRef}
        className={`public-modal ${variant === "sheet" ? "public-sheet" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
