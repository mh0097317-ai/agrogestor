import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, requirePermissao } from "@/modules/auth/guard";
import { listarFazendas } from "@/modules/fazendas/service";
import { listarCulturas } from "@/modules/culturas";
import { criarTalhaoAction } from "@/modules/talhoes/actions";
import { PageHeader } from "@/components/ui/page-header";
import { TalhaoForm } from "@/components/talhoes/talhao-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Warehouse } from "lucide-react";

export const metadata: Metadata = { title: "Novo talhão" };

export default async function NovoTalhaoPage({
  searchParams,
}: {
  searchParams: Promise<{ fazenda?: string }>;
}) {
  await requirePermissao("talhoes.editar");
  const session = await requireSession();
  const { fazenda } = await searchParams;

  const [fazendas, culturas] = await Promise.all([
    listarFazendas(session.tenantId),
    listarCulturas(session.tenantId),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Novo talhão"
        breadcrumb={<Link href="/talhoes" className="hover:text-ink">Talhões</Link>}
      />
      {fazendas.length === 0 ? (
        <EmptyState
          icon={<Warehouse size={20} />}
          title="Cadastre uma fazenda primeiro"
          description="Talhões pertencem a uma fazenda. Cadastre uma propriedade antes."
          action={<Link href="/fazendas/nova"><Button>Nova fazenda</Button></Link>}
        />
      ) : (
        <TalhaoForm
          action={criarTalhaoAction}
          fazendas={fazendas.map((f) => ({ id: f.id, label: f.nome }))}
          culturas={culturas.map((c) => ({ id: c.id, label: c.nome }))}
          defaults={{ fazendaId: fazenda }}
          submitLabel="Cadastrar talhão"
        />
      )}
    </div>
  );
}
