import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Agrogestor",
    template: "%s · Agrogestor",
  },
  description: "Plataforma de gestão rural — fazendas, safras, operações, estoque e financeiro.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
