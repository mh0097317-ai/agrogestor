import type { Metadata } from "next";
import { requireSession } from "@/modules/auth/guard";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = { title: "Relatórios" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Relatórios" fase={8} descricao="Dashboards analíticos, resultado da safra e comparação entre safras." />;
}
