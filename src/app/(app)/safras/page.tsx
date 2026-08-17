import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Sprout } from "lucide-react";
import { requireSession } from "@/modules/auth/guard";
import { listarSafras, calcularIndicadores } from "@/modules/safras/service";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { statusSafra } from "@/lib/status";
import { formatBRL, formatHa, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Safras" };

export default async function SafrasPage() {
  const session = await requireSession();
  const safras = await listarSafras(session.tenantId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Safras"
        subtitle="Ciclos de produção — do plantio ao resultado."
        actions={<Link href="/safras/nova"><Button><Plus size={18} /> Nova safra</Button></Link>}
      />

      {safras.length === 0 ? (
        <EmptyState
          icon={<Sprout size={22} />}
          title="Nenhuma safra cadastrada"
          description="Crie uma safra, vincule talhões e acompanhe custos, produção e resultado."
          action={<Link href="/safras/nova"><Button><Plus size={18} /> Nova safra</Button></Link>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {safras.map((s) => {
            const st = statusSafra[s.status];
            const ind = calcularIndicadores(s);
            const unidade = s.cultura?.unidadeProducao ?? "sc";
            return (
              <Link key={s.id} href={`/safras/${s.id}`}>
                <Card className="h-full p-5 transition-shadow hover:shadow-[var(--shadow-card-lg)]">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">
                        {s.cultura?.nome ?? "Safra"}
                      </div>
                      <h3 className="tnum mt-0.5 text-xl font-bold text-ink">{s.nome}</h3>
                    </div>
                    <Badge tom={st.tom}>{st.label}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-[13px]">
                    <Metric label="Área plantada" value={formatHa(ind.areaPlantada)} />
                    <Metric label="Produção estimada" value={`${formatNumber(ind.producaoEstimada)} ${unidade}`} />
                    <Metric label="Receita prevista" value={formatBRL(ind.receitaPrevista)} />
                    <Metric label="Talhões" value={String(s._count.talhoes)} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-subtle">{label}</div>
      <div className="tnum mt-0.5 font-semibold text-ink">{value}</div>
    </div>
  );
}
