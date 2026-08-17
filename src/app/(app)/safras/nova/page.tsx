import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, requirePermissao } from "@/modules/auth/guard";
import { listarFazendas } from "@/modules/fazendas/service";
import { listarCulturas } from "@/modules/culturas";
import { listarTalhoes } from "@/modules/talhoes/service";
import { PageHeader } from "@/components/ui/page-header";
import { SafraForm } from "@/components/safras/safra-form";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Nova safra" };

export default async function NovaSafraPage() {
  await requirePermissao("safras.editar");
  const session = await requireSession();

  const [fazendas, culturas, talhoes] = await Promise.all([
    listarFazendas(session.tenantId),
    listarCulturas(session.tenantId),
    listarTalhoes(session.tenantId),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Nova safra"
        breadcrumb={<Link href="/safras" className="hover:text-ink">Safras</Link>}
        subtitle="Defina cultura, talhões e estimativas do ciclo."
      />
      <SafraForm
        fazendas={fazendas.map((f) => ({ id: f.id, label: f.nome }))}
        culturas={culturas.map((c) => ({ id: c.id, label: c.nome }))}
        talhoes={talhoes.map((t) => ({
          id: t.id,
          codigo: t.codigo,
          fazenda: t.fazenda.nome,
          area: formatNumber(Number(t.area), { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        }))}
      />
    </div>
  );
}
