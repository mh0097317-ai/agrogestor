import type { Metadata } from "next";
import { requireSession } from "@/modules/auth/guard";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = { title: "Máquinas" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Máquinas" fase={4} descricao="Tratores, colheitadeiras e implementos — horímetro, combustível, manutenção e custos." />;
}
