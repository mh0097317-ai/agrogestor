import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  // Proteções básicas do navegador em todas as páginas: ninguém embute o app
  // em outro site (clickjacking), sem adivinhar tipo de arquivo, e o endereço
  // completo (com token de agendamento) não vaza para sites de fora.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
        ],
      },
    ];
  },
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
