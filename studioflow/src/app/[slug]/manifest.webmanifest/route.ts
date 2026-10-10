import { businessApp } from "@/services/business-app";
export const dynamic = "force-dynamic";

/** Cada estabelecimento vira um app na tela de início do cliente. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const app = await businessApp(slug);
  if (!app) return new Response("not found", { status: 404 });
  const short = app.name.length > 12 ? app.name.split(/\s+/)[0].slice(0, 12) : app.name;
  const manifest = {
    id: `/${slug}`,
    name: app.name,
    short_name: short,
    description: `Agende seu horário na ${app.name}.`,
    start_url: `/${slug}?app=1`,
    scope: `/${slug}`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F0E8",
    theme_color: app.color,
    lang: "pt-BR",
    categories: ["lifestyle", "business"],
    icons: [
      { src: `/${slug}/app-icon/192`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/${slug}/app-icon/512`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/${slug}/app-icon/maskable`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agendar", short_name: "Agendar", url: `/${slug}/agendar?app=1` },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
