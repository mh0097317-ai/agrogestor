import type { Metadata } from "next";
import { requireSession } from "@/modules/auth/guard";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = { title: "Colheita" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Colheita" fase={5} descricao="Registro de colheita, produção por talhão, sacas por hectare e custo por saca." />;
}
