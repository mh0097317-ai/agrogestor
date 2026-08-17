import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DollarSign, Sprout, TrendingUp, Wallet, Grid2x2 } from "lucide-react";
import { requireSession } from "@/modules/auth/guard";
import { obterSafra, calcularIndicadores } from "@/modules/safras/service";
import { excluirSafraAction } from "@/modules/safras/actions";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { StageStepper } from "@/components/ui/stepper";
import { EtapaControl } from "@/components/safras/etapa-control";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete";
import { statusSafra, statusTalhao, ETAPAS_LABEL } from "@/lib/status";
import { formatBRL, formatHa, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Safra" };

export default async function SafraDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const safra = await obterSafra(session.tenantId, id);
  if (!safra) notFound();

  const st = statusSafra[safra.status];
  const ind = calcularIndicadores(safra);
  const unidade = safra.cultura?.unidadeProducao ?? "sc";
  const custoHa = ind.areaPlantada > 0 ? ind.custo / ind.areaPlantada : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${safra.cultura?.nome ?? "Safra"} · ${safra.nome}`}
        breadcrumb={<Link href="/safras" className="hover:text-ink">Safras</Link>}
        subtitle={safra.fazenda?.nome}
        actions={<ConfirmDeleteButton action={excluirSafraAction.bind(null, id)} />}
      />

      <div className="flex items-center gap-3">
        <Badge tom={st.tom}>{st.label}</Badge>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Grid2x2 size={20} />} label="Área plantada" value={formatHa(ind.areaPlantada)} />
        <KpiCard icon={<Sprout size={20} />} iconTone="blue" label="Produção estimada"
          value={`${formatNumber(ind.producaoEstimada)} ${unidade}`} />
        <KpiCard icon={<DollarSign size={20} />} label="Custo da safra"
          value={formatBRL(ind.custo)} footer={<span className="text-subtle">Custo/ha {formatBRL(custoHa)} · Fase 3</span>} />
        <KpiCard icon={<Wallet size={20} />} iconTone="amber" label="Receita prevista" value={formatBRL(ind.receitaPrevista)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard icon={<TrendingUp size={20} />} label="Resultado projetado"
          value={formatBRL(ind.resultado)}
          footer={
            ind.custo > 0
              ? <Badge tom="green">Margem {ind.margem.toFixed(1)}%</Badge>
              : <span className="text-subtle">Sem custos lançados (Fase 3)</span>
          } />
        <KpiCard icon={<DollarSign size={20} />} iconTone="blue" label="Preço de venda previsto"
          value={safra.precoVendaPrevisto ? `${formatBRL(Number(safra.precoVendaPrevisto))}/${unidade}` : "—"} />
      </div>

      {/* Situação da safra */}
      <Card>
        <CardHeader>
          <CardTitle>Situação da Safra</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <StageStepper
            etapas={safra.etapas.map((e) => ({ nome: ETAPAS_LABEL[e.etapa], status: e.status }))}
          />
          <div className="border-t border-border pt-4">
            <div className="mb-2 text-[12px] font-medium text-muted">Atualizar etapas</div>
            <EtapaControl safraId={id} etapas={safra.etapas.map((e) => ({ etapa: e.etapa, status: e.status }))} />
          </div>
        </CardContent>
      </Card>

      {/* Talhões */}
      <Card>
        <CardHeader>
          <CardTitle>Talhões da safra</CardTitle>
          <span className="text-xs text-subtle">{safra.talhoes.length} vinculados</span>
        </CardHeader>
        <CardContent>
          {safra.talhoes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nenhum talhão vinculado a esta safra.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Talhão</Th>
                  <Th>Fazenda</Th>
                  <Th className="text-right">Área plantada</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {safra.talhoes.map((st) => {
                  const status = statusTalhao[st.talhao.status];
                  return (
                    <Tr key={st.id}>
                      <Td className="font-bold text-ink">
                        <Link href={`/talhoes/${st.talhaoId}`} className="hover:text-primary-600">{st.talhao.codigo}</Link>
                      </Td>
                      <Td className="text-muted">{st.talhao.fazenda.nome}</Td>
                      <Td className="tnum text-right">{formatHa(Number(st.areaPlantada))}</Td>
                      <Td><Badge tom={status.tom}>{status.label}</Badge></Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
