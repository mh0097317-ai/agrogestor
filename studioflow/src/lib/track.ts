/**
 * Visitas e cliques da página pública, para a auditoria do /admin.
 * Só um identificador aleatório do aparelho: sem nome, telefone ou IP.
 */
const visitorKey = "studioflow:visitor";

function visitor() {
  try {
    let id = localStorage.getItem(visitorKey);
    if (!id || !/^[a-z0-9]{16,40}$/.test(id)) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
        byte.toString(36).padStart(2, "0"),
      ).join("").slice(0, 24);
      localStorage.setItem(visitorKey, id);
    }
    return id;
  } catch {
    return "anonimo0000000000";
  }
}

export type TrackKind =
  | "view"
  | "agendar"
  | "whatsapp"
  | "instagram"
  | "localizacao"
  | "compartilhar"
  | "chat"
  | "clube"
  | "etapa"
  | "agendou";

export function track(slug: string, kind: TrackKind, detail = "") {
  if (typeof window === "undefined") return;
  try {
    let ref = "";
    if (kind === "view" && document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host !== location.hostname) ref = host;
    }
    const body = JSON.stringify({ visitor: visitor(), kind, detail: detail.slice(0, 60), ref });
    const url = `/api/public/${encodeURIComponent(slug)}/track`;
    if (navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) return;
    void fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(
      () => undefined,
    );
  } catch {
    // A métrica nunca atrapalha o cliente.
  }
}

/** O que um clique na página significa, pelo link ou por `data-track`. */
export function clickKind(target: Element | null, slug: string): TrackKind | null {
  const marked = target?.closest?.("[data-track]")?.getAttribute("data-track");
  if (marked) return marked as TrackKind;
  const href = target?.closest?.("a[href]")?.getAttribute("href") || "";
  if (href.startsWith(`/${slug}/agendar`)) return "agendar";
  if (href.startsWith(`/${slug}/clube`)) return "clube";
  if (/wa\.me|whatsapp\.com/.test(href)) return "whatsapp";
  if (/instagram\.com/.test(href)) return "instagram";
  if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|waze\.com/.test(href)) return "localizacao";
  return null;
}
