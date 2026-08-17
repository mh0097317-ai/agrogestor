import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, requirePermissao } from "@/modules/auth/guard";
import { obterTalhao } from "@/modules/talhoes/service";
import { atualizarTalhaoAction } from "@/modules/talhoes/actions";
import { listarFazendas } from "@/modules/fazendas/service";
import { listarCulturas } from "@/modules/culturas";
import { PageHeader } from "@/components/ui/page-header";
import { TalhaoForm } from "@/components/talhoes/talhao-form";

export const metadata: Metadata = { title: "Editar talhão" };

export default async function EditarTalhaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissao("talhoes.editar");
  const session = await requireSession();
  const { id } = await params;

  const [talhao, fazendas, culturas] = await Promise.all([
    obterTalhao(session.tenantId, id),
    listarFazendas(session.tenantId),
    listarCulturas(session.tenantId),
  ]);
  if (!talhao) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={`Editar ${talhao.codigo}`}
        breadcrumb={<Link href={`/talhoes/${id}`} className="hover:text-ink">{talhao.codigo}</Link>}
      />
      <TalhaoForm
        action={atualizarTalhaoAction.bind(null, id)}
        fazendas={fazendas.map((f) => ({ id: f.id, label: f.nome }))}
        culturas={culturas.map((c) => ({ id: c.id, label: c.nome }))}
        submitLabel="Salvar alterações"
        cancelHref={`/talhoes/${id}`}
        defaults={{
          fazendaId: talhao.fazendaId,
          codigo: talhao.codigo,
          nome: talhao.nome ?? "",
          area: String(talhao.area).replace(".", ","),
          culturaAtualId: talhao.culturaAtualId ?? "",
          status: talhao.status,
        }}
      />
    </div>
  );
}
