import { ImageResponse } from "next/og";
import { monogram } from "@/lib/utils";
import { businessApp } from "@/services/business-app";
export const dynamic = "force-dynamic";

/**
 * The icon renderer only reads PNG/JPEG: any other logo (WebP, AVIF) is
 * converted first. On any failure the icon falls back to the initials.
 */
async function pngLogo(src: string, size: number) {
  if (src.startsWith("data:image/png") || src.startsWith("data:image/jpeg"))
    return src;
  if (!/^https:\/\//.test(src)) return "";
  try {
    const response = await fetch(src, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return "";
    const input = Buffer.from(await response.arrayBuffer());
    if (input.byteLength > 8_000_000) return "";
    const { default: sharp } = await import("sharp");
    const png = await sharp(input)
      .resize(size, size, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return "";
  }
}

/** Ícone do app: a logo da casa sobre a cor dela, ou as iniciais. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; size: string }> },
) {
  const { slug, size: raw } = await params;
  const app = await businessApp(slug);
  if (!app) return new Response("not found", { status: 404 });
  const maskable = raw === "maskable";
  const size = maskable ? 512 : raw === "180" ? 180 : raw === "192" ? 192 : 512;
  // Área segura do ícone adaptativo: 80% do centro.
  const inner = Math.round(size * (maskable ? 0.56 : 0.7));
  const logo = await pngLogo(app.logo, inner * 2);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: app.color,
          borderRadius: maskable || size === 180 ? 0 : size * 0.22,
        }}
      >
        {logo ? (
          <img
            src={logo}
            width={inner}
            height={inner}
            style={{ objectFit: "contain", borderRadius: inner * 0.18 }}
            alt=""
          />
        ) : (
          <div
            style={{
              display: "flex",
              color: "#F4F0E8",
              fontSize: inner * 0.62,
              fontWeight: 700,
              letterSpacing: -2,
              fontFamily: "Georgia, serif",
            }}
          >
            {monogram(app.name) || "S"}
          </div>
        )}
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}
