import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const titulo = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-titulo", weight: ["500", "600", "700", "800"] });
const corpo = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-corpo" });

export const metadata: Metadata = {
  title: { default: "Agendaí — agenda online para barbearias e salões", template: "%s · Agendaí" },
  description:
    "Seu cliente marca o horário sozinho, 24h por dia. Você e ele recebem o aviso no WhatsApp. Feito para barbearias, salões femininos e masculinos.",
};

export const viewport: Viewport = {
  themeColor: "#17151C",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${titulo.variable} ${corpo.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
