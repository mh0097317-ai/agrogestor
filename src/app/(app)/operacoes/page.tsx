import type { Metadata } from "next";
import { requireSession } from "@/modules/auth/guard";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = { title: "Operações" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Operações" fase={3} descricao="Registro de operações agrícolas com consumo automático de estoque e rateio de custo por talhão e safra." />;
}
