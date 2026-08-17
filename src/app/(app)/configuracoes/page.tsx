import type { Metadata } from "next";
import { requireSession } from "@/modules/auth/guard";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = { title: "Configurações" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Configurações" fase={1} descricao="Gestão de empresa, usuários, perfis e preferências. Cadastro de usuários e permissões em breve." />;
}
