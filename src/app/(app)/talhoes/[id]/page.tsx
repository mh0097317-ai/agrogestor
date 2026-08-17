import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Warehouse } from "lucide-react";
import { requireSession } from "@/modules/auth/guard";
import { obterTalhao } from "@/modules/talhoes/service";
import { excluirTalhaoAction } from "@/modules/talhoes/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete";
import { statusTalhao } from "@/lib/status";
import { formatHa } from "@/lib/utils";

export const metadata: Metadata = { title: "Talhão" };

export default async function TalhaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const talhao = await obterTalhao(session.tenantId, id);
  if (!talhao) notFound();

  const st = statusTalhao[talhao.status];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={talhao.codigo + (talhao.nome ? ` · ${talhao.nome}` : "")}
        breadcrumb={<Link href="/talhoes" className="hover:text-ink">Talhões</Link>}
        subtitle={talhao.fazenda.nome}
        actions={
          <>
            <ConfirmDeleteButton action={excluirTalhaoAction.bind(null, id)} />
            <Link href={`/talhoes/${id}/editar`}>
              <Button variant="secondary" size="sm"><Pencil size={16} /> Editar</Button>
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge tom={st.tom}>{st.label}</Badge>
        {talhao.culturaAtual && (
          <span className="text-sm text-muted">
            Cultura atual: <b className="text-ink">{talhao.culturaAtual.nome}</b>
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Área" value={formatHa(Number(talhao.area))} />
        <Stat label="Custo acumulado" value="—" hint="Fase 3" />
        <Stat label="Custo por hectare" value="—" hint="Fase 3" />
        <Stat label="Produtividade" value="—" hint="Fase 5" />
      </div>

      <Card>
        <CardContent className="flex items-center gap-3 pt-5 text-sm text-muted">
          <Warehouse size={18} className="text-primary-600" />
          Pertence à fazenda{" "}
          <Link href={`/fazendas/${talhao.fazendaId}`} className="font-semibold text-primary-600 hover:underline">
            {talhao.fazenda.nome}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div className="text-[12px] uppercase tracking-wide text-subtle">{label}</div>
          {hint && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-subtle">{hint}</span>}
        </div>
        <div className="tnum mt-1.5 text-2xl font-bold text-ink">{value}</div>
      </CardContent>
    </Card>
  );
}
