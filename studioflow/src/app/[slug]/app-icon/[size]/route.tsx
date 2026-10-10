import { ImageResponse } from "next/og";
import { monogram } from "@/lib/utils";
import { businessApp } from "@/services/business-app";
export const dynamic = "force-dynamic";

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
  const logo = /^(https:\/\/|data:image\/)/.test(app.logo) ? app.logo : "";
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
