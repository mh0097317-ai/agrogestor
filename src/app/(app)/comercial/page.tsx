import type { Metadata } from "next";
import { requireSession } from "@/modules/auth/guard";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = { title: "Comercial" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Comercial" fase={7} descricao="Comercialização da produção: clientes, contratos, preços, frete, entrega e recebimento." />;
}
