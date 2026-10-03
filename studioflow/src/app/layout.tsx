import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/toast";
import { PwaRegister } from "@/components/pwa-register";
import { MotionProvider, PointerEffects } from "@/components/motion";
import "./globals.css";
import "@/features/dashboard/shell.css";
import "@/features/dashboard/overview.css";
import "@/features/agenda/agenda.css";
import "@/styles/responsive.css";
import "@/styles/motion.css";
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
    default: "StudioFlow · Agenda online para barbearias e salões",
    template: "%s · StudioFlow",
  },
  description:
    "Agenda online, clientes e caixa para barbearias, salões e estúdios de beleza.",
  applicationName: "StudioFlow",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StudioFlow",
  },
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
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
          <MotionProvider />
          <PointerEffects />
        </ToastProvider>
      </body>
    </html>
  );
}
