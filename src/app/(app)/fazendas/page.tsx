import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Plus, Warehouse, Grid2x2 } from "lucide-react";
import { requireSession } from "@/modules/auth/guard";
import { listarFazendas } from "@/modules/fazendas/service";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatHa } from "@/lib/utils";

export const metadata: Metadata = { title: "Fazendas" };

export default async function FazendasPage() {
  const session = await requireSession();
  const fazendas = await listarFazendas(session.tenantId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fazendas"
        subtitle="Propriedades rurais da sua operação."
        actions={
          <Link href="/fazendas/nova">
            <Button>
              <Plus size={18} /> Nova fazenda
            </Button>
          </Link>
        }
      />

      {fazendas.length === 0 ? (
        <EmptyState
          icon={<Warehouse size={22} />}
          title="Nenhuma fazenda cadastrada"
          description="Cadastre sua primeira propriedade para começar a organizar talhões e safras."
          action={
            <Link href="/fazendas/nova">
              <Button>
                <Plus size={18} /> Cadastrar fazenda
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fazendas.map((f) => (
            <Link key={f.id} href={`/fazendas/${f.id}`}>
              <Card className="h-full p-5 transition-shadow hover:shadow-[var(--shadow-card-lg)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-primary-50 text-primary-600">
                    <Warehouse size={20} />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-muted">
                    <Grid2x2 size={13} /> {f._count.talhoes} talhões
                  </span>
                </div>
                <h3 className="mt-4 text-[16px] font-bold text-ink">{f.nome}</h3>
                {(f.municipio || f.estado) && (
                  <p className="mt-1 flex items-center gap-1 text-[13px] text-muted">
                    <MapPin size={13} /> {[f.municipio, f.estado].filter(Boolean).join(" – ")}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-5 border-t border-border pt-3 text-[13px]">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-subtle">Área total</div>
                    <div className="tnum font-semibold text-ink">
                      {f.areaTotal ? formatHa(Number(f.areaTotal)) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-subtle">Produtiva</div>
                    <div className="tnum font-semibold text-ink">
                      {f.areaProdutiva ? formatHa(Number(f.areaProdutiva)) : "—"}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
