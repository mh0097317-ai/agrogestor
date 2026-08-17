import type { Metadata } from "next";
import { Sprout } from "lucide-react";
import { requireSession } from "@/modules/auth/guard";
import { listarCulturas } from "@/modules/culturas";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CulturaForm } from "@/components/culturas/cultura-form";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Culturas" };

export default async function CulturasPage() {
  const session = await requireSession();
  const culturas = await listarCulturas(session.tenantId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Culturas" subtitle="Culturas disponíveis para talhões e safras." />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardContent className="pt-5">
            {culturas.length === 0 ? (
              <EmptyState icon={<Sprout size={20} />} title="Nenhuma cultura" description="Adicione uma cultura ao lado." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {culturas.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-[12px] border border-border p-3.5">
                    <span
                      className="grid h-10 w-10 place-items-center rounded-[10px] text-white"
                      style={{ background: c.cor ?? "#16A34A" }}
                    >
                      <Sprout size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{c.nome}</div>
                      <div className="text-[12px] text-muted">
                        {c.unidadeProducao}
                        {c.cicloDias ? ` · ciclo ${c.cicloDias} dias` : ""} · {c._count.talhoes} talhões
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Nova cultura</CardTitle>
          </CardHeader>
          <CardContent>
            <CulturaForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
