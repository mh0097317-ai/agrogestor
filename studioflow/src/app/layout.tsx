import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/toast";
import { PwaRegister } from "@/components/pwa-register";
import { MotionProvider } from "@/components/motion";
import "./globals.css";
import "@/features/dashboard/shell.css";
import "@/features/dashboard/overview.css";
import "@/features/agenda/agenda.css";
import "@/styles/responsive.css";
import "@/styles/motion.css";
// Hanken Grotesk for the interface, Fraunces for titles and numbers.
const hanken = localFont({
  src: [{ path: "./fonts/hanken-grotesk.woff2", weight: "400 700" }],
  variable: "--font-ui",
  display: "swap",
});
const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces.woff2", weight: "400 600", style: "normal" },
    { path: "./fonts/fraunces-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-display",
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
  themeColor: "#16130F",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body
        className={`${hanken.className} ${hanken.variable} ${fraunces.variable}`}
      >
        <ToastProvider>
          {children}
          <PwaRegister />
          <MotionProvider />
        </ToastProvider>
      </body>
    </html>
  );
}
