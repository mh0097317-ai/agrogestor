"use client";

import { useState } from "react";
import { Car, Copy, NavigationArrow, X } from "@phosphor-icons/react/dist/ssr";
import { MapPinIcon } from "@/components/brand-icons";
import type { Business } from "@/types";
import { PublicModal } from "./public-modal";

/** Links that open the address in Google Maps and Waze. */
export function mapLinks(business: Pick<Business, "address" | "mapsUrl">) {
  const query = encodeURIComponent(business.address);
  return {
    embed: `https://www.google.com/maps?q=${query}&output=embed`,
    google: business.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${query}`,
    route: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    waze: `https://waze.com/ul?q=${query}&navigate=yes`,
  };
}

/** "Como chegar": the Google map inside the page, with route, Waze and copy. */
export function LocationSheet({
  business,
  onClose,
}: {
  business: Pick<Business, "name" | "address" | "mapsUrl">;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const links = mapLinks(business);
  async function copy() {
    try {
      await navigator.clipboard.writeText(business.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  }
  return (
    <PublicModal labelId="location-title" onClose={onClose} variant="sheet">
      <header className="sheet-head">
        <span className="sheet-eyebrow">Como chegar</span>
        <h2 id="location-title">{business.name}</h2>
        <button type="button" className="sheet-close" aria-label="Fechar" onClick={onClose}>
          <X size={18} weight="bold" />
        </button>
      </header>
      <div className={`sheet-map ${mapReady ? "is-ready" : ""}`}>
        <iframe
          title={`Mapa: ${business.address}`}
          src={links.embed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setMapReady(true)}
        />
        <span className="sheet-map-wait" aria-hidden="true">
          <i />
        </span>
      </div>
      <div className="sheet-address">
        <p>{business.address}</p>
        <button type="button" onClick={copy} aria-live="polite">
          <Copy size={15} weight="bold" />
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <div className="sheet-actions">
        <a href={links.route} target="_blank" rel="noreferrer" className="sheet-primary">
          <NavigationArrow size={18} weight="fill" /> Traçar rota
        </a>
        <a href={links.google} target="_blank" rel="noreferrer">
          <MapPinIcon size={18} />
          {business.mapsUrl ? "Ver no Google" : "Google Maps"}
        </a>
        <a href={links.waze} target="_blank" rel="noreferrer">
          <Car size={18} weight="duotone" /> Waze
        </a>
      </div>
      {business.mapsUrl && (
        <p className="sheet-note">No Google você vê as fotos, as avaliações e o horário da casa.</p>
      )}
    </PublicModal>
  );
}
