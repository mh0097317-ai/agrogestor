import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  // O ffmpeg-static acha o binário pelo próprio caminho; empacotado, ele se perde.
  serverExternalPackages: ["ffmpeg-static"],
  // Fontes das artes do Marketing e o ffmpeg dos Reels (lidos em tempo de execução).
  outputFileTracingIncludes: {
    "/api/marketing/**": ["src/services/marketing/fonts/*.ttf"],
    "/api/admin/marketing": [
      "src/services/marketing/fonts/*.ttf",
      "node_modules/ffmpeg-static/ffmpeg",
    ],
    "/api/admin/marketing/**": ["src/services/marketing/fonts/*.ttf"],
    "/api/cron/marketing": [
      "src/services/marketing/fonts/*.ttf",
      "node_modules/ffmpeg-static/ffmpeg",
    ],
  },
};
export default config;
