import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StudioFlow · Gestão & agenda",
    short_name: "StudioFlow",
    description: "Seu negócio de beleza em boa fase.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#0B1B30",
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
        purpose: "maskable",
      },
    ],
  };
}
