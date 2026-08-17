import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, requirePermissao } from "@/modules/auth/guard";
import { obterFazenda } from "@/modules/fazendas/service";
import { atualizarFazendaAction } from "@/modules/fazendas/actions";
import { PageHeader } from "@/components/ui/page-header";
import { FazendaForm } from "@/components/fazendas/fazenda-form";

export const metadata: Metadata = { title: "Editar fazenda" };

export default async function EditarFazendaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissao("fazendas.editar");
  const session = await requireSession();
  const { id } = await params;
  const fazenda = await obterFazenda(session.tenantId, id);
  if (!fazenda) notFound();

  const action = atualizarFazendaAction.bind(null, id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Editar fazenda"
        breadcrumb={
          <Link href={`/fazendas/${id}`} className="hover:text-ink">
            {fazenda.nome}
          </Link>
        }
      />
      <FazendaForm
        action={action}
        submitLabel="Salvar alterações"
        cancelHref={`/fazendas/${id}`}
        defaults={{
          nome: fazenda.nome,
          produtorNome: fazenda.produtor?.nome ?? "",
          documento: fazenda.documento ?? "",
          municipio: fazenda.municipio ?? "",
          estado: fazenda.estado ?? "",
          areaTotal: fazenda.areaTotal ? String(fazenda.areaTotal).replace(".", ",") : "",
          areaProdutiva: fazenda.areaProdutiva ? String(fazenda.areaProdutiva).replace(".", ",") : "",
          observacoes: fazenda.observacoes ?? "",
        }}
      />
    </div>
  );
}
