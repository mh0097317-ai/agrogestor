import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StudioFlow · Gestão & agenda",
    short_name: "StudioFlow",
    description: "Agenda online e gestão para barbearias e salões.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F7F3EC",
    theme_color: "#16130F",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
