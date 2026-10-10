import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  // Fontes das artes do Marketing (lidas em tempo de execução).
  outputFileTracingIncludes: {
    "/api/marketing/**": ["src/services/marketing/fonts/*.ttf"],
    "/api/admin/marketing/**": ["src/services/marketing/fonts/*.ttf"],
    "/api/cron/marketing": ["src/services/marketing/fonts/*.ttf"],
  },
};
export default config;
