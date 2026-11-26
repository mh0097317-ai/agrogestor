"use client";
import { useEffect, useState } from "react";
import { CheckCircle, WarningCircle, Info } from "@phosphor-icons/react/dist/ssr";
import type { ReadinessItem } from "@/lib/platform-readiness";

/** Prontidão para operar e vender: só diz se cada item está configurado. */
export function ReadinessCard() {
  const [items, setItems] = useState<ReadinessItem[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/readiness", { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Não foi possível conferir.");
        setItems(body.items);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Não foi possível conferir.");
      });
    return () => controller.abort();
  }, []);
  if (error) return <p className="pf-readiness-error" role="status">{error}</p>;
  if (!items) return null;
  const pending = items.filter((i) => !i.ok);
  return (
    <section className="pf-readiness" aria-labelledby="pf-readiness-title">
      <header>
        <div>
          <span className="pf-eyebrow">Prontidão da plataforma</span>
          <h2 id="pf-readiness-title">
            {pending.length
              ? `${pending.length} ${pending.length === 1 ? "item pede" : "itens pedem"} sua ação`
              : "Tudo configurado"}
          </h2>
        </div>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Ocultar" : "Ver lista"}
        </button>
      </header>
      {open && (
        <ul role="list">
          {[...pending, ...items.filter((i) => i.ok)].map((item) => (
            <li key={item.id} data-ok={item.ok ? "" : undefined}>
              {item.ok ? (
                <CheckCircle size={18} weight="fill" aria-label="Configurado" />
              ) : item.manual ? (
                <Info size={18} weight="fill" aria-label="Conferir manualmente" />
              ) : (
                <WarningCircle size={18} weight="fill" aria-label="Pendente" />
              )}
              <span>
                <strong>{item.label}</strong>
                {!item.ok && <small>{item.fix}</small>}
              </span>
              <em>{item.area}</em>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
