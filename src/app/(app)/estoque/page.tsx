import type { Metadata } from "next";
import { requireSession } from "@/modules/auth/guard";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = { title: "Estoque" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Estoque" fase={2} descricao="Controle de insumos, fertilizantes, defensivos, sementes e combustíveis — com saldo, custo médio e alertas de estoque baixo." />;
}
