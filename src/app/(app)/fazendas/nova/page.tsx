import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { FazendaForm } from "@/components/fazendas/fazenda-form";
import { criarFazendaAction } from "@/modules/fazendas/actions";
import { requirePermissao } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Nova fazenda" };

export default async function NovaFazendaPage() {
  await requirePermissao("fazendas.editar");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Nova fazenda"
        breadcrumb={<Link href="/fazendas" className="hover:text-ink">Fazendas</Link>}
        subtitle="Cadastre uma propriedade rural."
      />
      <FazendaForm action={criarFazendaAction} submitLabel="Cadastrar fazenda" />
    </div>
  );
}
