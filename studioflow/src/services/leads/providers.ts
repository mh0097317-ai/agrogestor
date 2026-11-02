import { DomainError } from "@/lib/availability";
import { instagramHandle, normalizePhone } from "./lead-logic";

/** Uma barbearia como a fonte devolve, antes de investigar o site. */
export interface FoundPlace {
  placeId: string;
  name: string;
  phone: string;
  website: string;
  instagram: string;
  address: string;
  category: string;
  rating: number | null;
  reviews: number | null;
  mapsUrl: string;
  source: "google_maps" | "openstreetmap";
}

const cleanSite = (value: unknown) => {
  const site = typeof value === "string" ? value.trim() : "";
  if (!site || /instagram\.com|facebook\.com|wa\.me|linktr\.ee/i.test(site)) return "";
  return site.slice(0, 500);
};

const instagramFrom = (value: unknown) =>
  typeof value === "string" && /instagram\.com/i.test(value) ? instagramHandle(value) : "";

/**
 * Google Maps pela Serper: até 20 casas por página, com telefone, site,
 * nota e avaliações. Uma busca por página.
 */
export async function searchSerperMaps(input: {
  apiKey: string;
  term: string;
  city: string;
  pages: number;
}): Promise<FoundPlace[]> {
  const found: FoundPlace[] = [];
  for (let page = 1; page <= input.pages; page++) {
    const response = await fetch("https://google.serper.dev/maps", {
      method: "POST",
      headers: { "X-API-KEY": input.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        q: `${input.term} em ${input.city}`,
        gl: "br",
        hl: "pt-br",
        page,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    if (!response) throw new DomainError("A Serper não respondeu. Tente de novo.", 502);
    if (response.status === 401 || response.status === 403)
      throw new DomainError("A Serper recusou a chave. Confira em Captação → Fonte.", 409);
    if (response.status === 429 || response.status === 402)
      throw new DomainError("Os créditos da Serper acabaram ou estão no limite por minuto.", 429);
    if (!response.ok) throw new DomainError("A Serper não conseguiu buscar agora.", 502);
    const data = (await response.json().catch(() => ({}))) as { places?: Record<string, unknown>[] };
    const places = Array.isArray(data.places) ? data.places : [];
    for (const place of places) {
      const name = typeof place.title === "string" ? place.title.trim() : "";
      if (!name) continue;
      const id = String(place.placeId || place.cid || place.fid || "");
      found.push({
        placeId: id ? `g:${id}` : `g:${name}:${place.address || ""}`.slice(0, 200),
        name: name.slice(0, 200),
        phone: normalizePhone(String(place.phoneNumber || "")),
        website: cleanSite(place.website),
        instagram: instagramFrom(place.website),
        address: String(place.address || "").slice(0, 300),
        category: String(place.type || (Array.isArray(place.types) ? place.types[0] : "") || "").slice(0, 120),
        rating: typeof place.rating === "number" ? Math.round(place.rating * 10) / 10 : null,
        reviews: typeof place.ratingCount === "number" ? Math.round(place.ratingCount) : null,
        mapsUrl: place.cid ? `https://www.google.com/maps?cid=${place.cid}` : "",
        source: "google_maps",
      });
    }
    if (places.length < 10) break;
  }
  return found;
}

/**
 * OpenStreetMap: grátis e sem conta, mas só traz quem foi mapeado. Bom para
 * testar; costuma ter bem menos barbearias que o Google.
 */
export async function searchOpenStreetMap(input: { city: string }): Promise<FoundPlace[]> {
  const city = input.city.split(",")[0].trim().replace(/["\\]/g, "");
  const query = `[out:json][timeout:25];
area["name"="${city}"]["boundary"="administrative"]["admin_level"~"^(7|8)$"]->.a;
(nwr["shop"="hairdresser"](area.a);nwr["shop"="barber"](area.a););
out center tags 300;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "StudioFlow/1.0 (+https://app.studioflowapp.tech)",
    },
    body: new URLSearchParams({ data: query }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!response?.ok) throw new DomainError("O OpenStreetMap não respondeu. Tente de novo.", 502);
  const data = (await response.json().catch(() => ({}))) as {
    elements?: { type: string; id: number; tags?: Record<string, string> }[];
  };
  return (data.elements || [])
    .map((item) => {
      const tags = item.tags || {};
      const name = (tags.name || "").trim();
      const barber =
        /barb/i.test(name) || tags.shop === "barber" || /barber|male/i.test(tags.hairdresser || "");
      if (!name || !barber) return null;
      const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", ");
      return {
        placeId: `osm:${item.type}/${item.id}`,
        name: name.slice(0, 200),
        phone: normalizePhone(tags["contact:whatsapp"] || tags["contact:mobile"] || tags.phone || tags["contact:phone"]),
        website: cleanSite(tags.website || tags["contact:website"]),
        instagram: instagramHandle(tags["contact:instagram"] || "") || instagramFrom(tags.website),
        address: [street, tags["addr:suburb"], tags["addr:city"] || city].filter(Boolean).join(" · ").slice(0, 300),
        category: "Barbearia",
        rating: null,
        reviews: null,
        mapsUrl: `https://www.openstreetmap.org/${item.type}/${item.id}`,
        source: "openstreetmap" as const,
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item);
}

/** Demonstração local: casas inventadas, sem rede. */
export function demoPlaces(city: string): FoundPlace[] {
  const base: [string, string, number, number, string, string][] = [
    ["Barbearia Navalha de Ouro", "62991234501", 4.8, 312, "", "navalhadeouro"],
    ["Dom Barba Barbearia", "62992234502", 4.6, 188, "domb.test", "dombarba"],
    ["Corte Fino Barbershop", "6232234503", 4.3, 64, "", ""],
    ["Barbearia do Zé", "62994234504", 4.9, 41, "", "barbeariadoze"],
    ["Vintage Barber Club", "62995234505", 4.7, 523, "vintage.test", "vintagebarberclub"],
    ["Studio Degradê", "62996234506", 4.5, 97, "", "studiodegrade"],
    ["Barbearia Central", "", 4.1, 22, "", ""],
    ["Black Fade Barbearia", "62998234508", 4.8, 156, "", "blackfade"],
  ];
  return base.map(([name, phone, rating, reviews, website, instagram], index) => ({
    placeId: `demo:${index + 1}`,
    name,
    phone,
    website,
    instagram,
    address: `Rua ${index + 3}, ${100 + index * 17} · Centro, ${city}`,
    category: "Barbearia",
    rating,
    reviews,
    mapsUrl: "",
    source: "google_maps" as const,
  }));
}
