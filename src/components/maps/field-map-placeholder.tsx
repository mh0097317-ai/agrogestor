import { MapPin } from "lucide-react";

/**
 * Placeholder do mapa de talhões (Fase 1). A geometria real (polígonos via
 * PostGIS/GeoJSON e desenho no mapa) chega em fase futura — aqui mostramos
 * uma representação visual dos talhões sem inventar coordenadas.
 */
export function FieldMapPlaceholder({
  talhoes,
}: {
  talhoes: { codigo: string; tom: string }[];
}) {
  return (
    <div className="relative overflow-hidden rounded-[12px] border border-border">
      <div className="h-[240px] w-full bg-gradient-to-br from-[#3B4A2E] to-[#59703F]">
        <svg className="h-full w-full opacity-[.12]" aria-hidden>
          <defs>
            <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0H0V48" fill="none" stroke="#fff" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {talhoes.length === 0 ? (
            <span className="rounded-full bg-black/30 px-3 py-1 text-[13px] font-medium text-white/90">
              Sem talhões cadastrados
            </span>
          ) : (
            talhoes.map((t) => (
              <span
                key={t.codigo}
                className="rounded-md px-2.5 py-1 text-[12px] font-bold text-white shadow"
                style={{ background: t.tom }}
              >
                {t.codigo}
              </span>
            ))
          )}
        </div>
        <p className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-[11.5px] text-white/85">
          <MapPin size={13} /> Mapa com geometria dos talhões chega em fase futura
        </p>
      </div>
    </div>
  );
}
