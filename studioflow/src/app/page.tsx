import type { Metadata } from "next";
import { Landing } from "@/features/landing/landing";

export const metadata: Metadata = {
  title: { absolute: "StudioFlow · Sua barbearia agendando sozinha, 24 horas" },
  description:
    "Página própria, agendamento online, lembrete no WhatsApp e recepcionista com IA para barbearias. Teste grátis.",
  openGraph: {
    title: "StudioFlow · Sua barbearia agendando sozinha, 24 horas",
    description:
      "Página própria, agendamento online, lembrete no WhatsApp e recepcionista com IA para barbearias.",
    images: ["/landing/salon.webp"],
    locale: "pt_BR",
    type: "website",
  },
};

export default function Home() {
  return <Landing />;
}
