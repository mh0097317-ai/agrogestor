import type { Metadata } from "next";
import { requireSession } from "@/modules/auth/guard";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = { title: "Assistente IA" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Assistente IA" fase={9} descricao="Assistente rural conectado com segurança aos seus dados, via funções controladas no backend." />;
}
