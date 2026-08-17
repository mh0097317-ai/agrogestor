import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign, Grid2x2, Sprout, TrendingUp, Wallet, Plus, Warehouse, Bell, ChevronRight,
} from "lucide-react";
import { requireSession } from "@/modules/auth/guard";
import { getDashboard } from "@/modules/dashboard/service";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StageStepper } from "@/components/ui/stepper";
import { Donut } from "@/components/charts/donut";
import { EmptyState } from "@/components/ui/empty-state";
import { ETAPAS_LABEL, nivelAlerta } from "@/lib/status";
import { formatBRL, formatHa, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

function saudacao(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage() {
  const session = await requireSession();
  const data = await getDashboard(session.tenantId);
  const agora = new Date();
  const primeiroNome = session.nome.split(" ")[0];

  const { safraAtual, indicadores } = data;
  const unidade = safraAtual?.cultura?.unidadeProducao ?? "sc";
  const custoHa = indicadores && indicadores.areaPlantada > 0 ? indicadores.custo / indicadores.areaPlantada : 0;

  const donutData = [
    ...data.distribuicaoCultura.map((c) => ({ name: c.nome, value: c.area, color: c.cor })),
    ...(data.areaSemCultura > 0
      ? [{ name: "Sem cultura", value: data.areaSemCultura, color: "#94A3B8" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Saudação */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-[-.02em] text-ink">
            {saudacao(agora)}, {primeiroNome}! 👋
          </h1>
          <p className="mt-1 text-sm text-muted first-letter:uppercase">
            {format(agora, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        {safraAtual && (
          <div className="flex items-center gap-2.5 rounded-[12px] bg-navy-900 px-4 py-2.5 text-white shadow-[var(--shadow-card)]">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[#93AEC4]">Safra atual</div>
              <b className="tnum text-sm">{safraAtual.nome}</b>
            </div>
          </div>
        )}
      </div>

      {!safraAtual ? (
        <EmptyState
          icon={<Sprout size={22} />}
          title="Comece criando sua estrutura"
          description="Cadastre fazendas e talhões, depois crie uma safra para ver seus indicadores aqui."
          action={
            <div className="flex gap-2">
              <Link href="/fazendas/nova"><Button variant="secondary"><Warehouse size={16} /> Nova fazenda</Button></Link>
              <Link href="/safras/nova"><Button><Plus size={16} /> Nova safra</Button></Link>
            </div>
          }
        />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard icon={<DollarSign size={20} />} label="Custo da Safra"
              value={formatBRL(indicadores!.custo)}
              footer={<span className="text-subtle">Chega na Fase 3</span>} />
            <KpiCard icon={<Grid2x2 size={20} />} label="Área Plantada" value={formatHa(indicadores!.areaPlantada)}
              footer={<span>{safraAtual.cultura?.nome ?? "—"}</span>} />
            <KpiCard icon={<Sprout size={20} />} iconTone="blue" label="Produção Estimada"
              value={`${formatNumber(indicadores!.producaoEstimada)} ${unidade}`} />
            <KpiCard icon={<TrendingUp size={20} />} label="Resultado Projetado"
              value={formatBRL(indicadores!.resultado)}
              footer={
                indicadores!.custo > 0
                  ? <Badge tom="green">Margem {indicadores!.margem.toFixed(1)}%</Badge>
                  : <span className="text-subtle">Sem custos lançados (Fase 3)</span>
              } />
            <KpiCard icon={<Wallet size={20} />} iconTone="amber" label="Receita Prevista"
              value={formatBRL(indicadores!.receitaPrevista)}
              footer={<span className="text-subtle">Custo/ha {formatBRL(custoHa)}</span>} />
          </div>

          {/* Situação da safra */}
          <Card>
            <CardHeader>
              <CardTitle>Situação da Safra {safraAtual.nome}</CardTitle>
              <Link href={`/safras/${safraAtual.id}`} className="text-[12.5px] font-semibold text-primary-600 hover:underline">
                Ver safra
              </Link>
            </CardHeader>
            <CardContent>
              <StageStepper etapas={safraAtual.etapas.map((e) => ({ nome: ETAPAS_LABEL[e.etapa], status: e.status }))} />
            </CardContent>
          </Card>

          {/* Distribuição + alertas */}
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Área por Cultura</CardTitle>
                <span className="text-xs text-subtle">{formatHa(data.areaTotalTalhoes)} em talhões</span>
              </CardHeader>
              <CardContent>
                <Donut data={donutData} centerLabel="total" centerValue={formatHa(data.areaTotalTalhoes)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alertas Inteligentes</CardTitle>
                <Link href="/alertas" className="text-[12.5px] font-semibold text-primary-600 hover:underline">Ver todos</Link>
              </CardHeader>
              <CardContent>
                {data.alertas.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-success-bg text-success">
                      <Bell size={18} />
                    </div>
                    <p className="text-sm text-muted">Nenhum alerta no momento.</p>
                    <p className="text-[12px] text-subtle">Alertas de estoque, manutenção e financeiro chegam nas próximas fases.</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {data.alertas.map((a) => {
                      const n = nivelAlerta[a.nivel];
                      return (
                        <div key={a.id} className="flex items-start gap-3 border-t border-border py-3 first:border-t-0">
                          <span className={"mt-0.5 h-2 w-2 shrink-0 rounded-full " + (n.tom === "red" ? "bg-danger" : n.tom === "amber" ? "bg-warning" : "bg-subtle")} />
                          <div className="flex-1">
                            <div className="text-[13px] font-semibold text-ink">{a.titulo}</div>
                            {a.descricao && <div className="text-[12px] text-muted">{a.descricao}</div>}
                          </div>
                          <Badge tom={n.tom}>{n.label}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Resumo de cadastros */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ResumoCard href="/fazendas" icon={<Warehouse size={18} />} label="Fazendas" value={data.fazendasCount} />
        <ResumoCard href="/talhoes" icon={<Grid2x2 size={18} />} label="Talhões" value={data.talhoesCount} />
        <ResumoCard href="/safras" icon={<Sprout size={18} />} label="Safras" value={data.safrasCount} />
      </div>
    </div>
  );
}

function ResumoCard({ href, icon, label, value }: { href: string; icon: React.ReactNode; label: string; value: number }) {
  return (
    <Link href={href}>
      <Card className="flex items-center justify-between p-5 transition-shadow hover:shadow-[var(--shadow-card-lg)]">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-primary-50 text-primary-600">{icon}</span>
          <div>
            <div className="tnum text-2xl font-bold text-ink">{value}</div>
            <div className="text-[13px] text-muted">{label}</div>
          </div>
        </div>
        <ChevronRight size={18} className="text-subtle" />
      </Card>
    </Link>
  );
}
