import type { Metadata } from "next";
import { requireSession } from "@/modules/auth/guard";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = { title: "Alertas" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Alertas" fase={8} descricao="Central de alertas: estoque, manutenção, financeiro, operações e produção — com níveis info, atenção e crítico." />;
}
