import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

/** Buscadores leem as páginas das casas; painel, API e links pessoais ficam fora. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/admin", "/booking/", "/atendimento/", "/equipe/", "/onboarding", "/auth/", "/tv"],
      },
    ],
    host: appUrl,
  };
}
