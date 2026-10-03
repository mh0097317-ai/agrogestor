import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/toast";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";
import "@/features/dashboard/shell.css";
import "@/features/dashboard/overview.css";
import "@/features/agenda/agenda.css";
import "@/styles/responsive.css";
const geist = localFont({
  src: [
    { path: "./fonts/geist-regular.ttf", weight: "400" },
    { path: "./fonts/geist-medium.ttf", weight: "500" },
    { path: "./fonts/geist-semibold.ttf", weight: "600" },
    { path: "./fonts/geist-bold.ttf", weight: "700" },
  ],
  display: "swap",
});
export const metadata: Metadata = {
  title: {
    default: "StudioFlow · Seu negócio em boa fase",
    template: "%s · StudioFlow",
  },
  description:
    "Agenda, clientes e gestão para negócios de beleza. Mais tempo para fazer o que você ama.",
  applicationName: "StudioFlow",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StudioFlow",
  },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1B30",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={geist.className}>
        <ToastProvider>
          {children}
          <PwaRegister />
        </ToastProvider>
      </body>
    </html>
  );
}
