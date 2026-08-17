import type { Metadata } from "next";
import { requireSession } from "@/modules/auth/guard";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = { title: "Financeiro" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Financeiro" fase={6} descricao="Contas a pagar e receber, fluxo de caixa, centros de custo e custo real por safra e talhão." />;
}
