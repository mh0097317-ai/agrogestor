"use client";

import { useEffect } from "react";

/**
 * O manifesto geral (do painel) entra em todas as páginas pelo app/manifest.ts.
 * Na página de uma casa, aponta para o manifesto dela: o cliente instala o app
 * da barbearia, com nome e ícone próprios, e não o painel do StudioFlow.
 */
export function AppManifest({ slug }: { slug: string }) {
  useEffect(() => {
    const href = `/${slug}/manifest.webmanifest`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previous = link?.getAttribute("href") || null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.setAttribute("href", href);
    return () => {
      if (previous) link?.setAttribute("href", previous);
    };
  }, [slug]);
  return null;
}
