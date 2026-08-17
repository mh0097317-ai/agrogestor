import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, MapPin, Grid2x2, Ruler } from "lucide-react";
import { requireSession } from "@/modules/auth/guard";
import { obterFazenda } from "@/modules/fazendas/service";
import { excluirFazendaAction } from "@/modules/fazendas/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete";
import { FieldMapPlaceholder } from "@/components/maps/field-map-placeholder";
import { statusTalhao } from "@/lib/status";
import { formatHa } from "@/lib/utils";

export const metadata: Metadata = { title: "Fazenda" };

const TOM_HEX: Record<string, string> = {
  green: "#2F7A40",
  amber: "#C08A22",
  red: "#A23A24",
  blue: "#2563EB",
  gray: "#64748B",
};

const TABS = [
  { id: "visao", label: "Visão Geral" },
  { id: "talhoes", label: "Talhões" },
] as const;

export default async function FazendaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const { tab } = await searchParams;
  const aba = typeof tab === "string" && TABS.some((t) => t.id === tab) ? tab : "visao";

  const fazenda = await obterFazenda(session.tenantId, id);
  if (!fazenda) notFound();

  const talhoes = fazenda.talhoes;
  const areaTalhoes = talhoes.reduce((acc, t) => acc + Number(t.area), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={fazenda.nome}
        breadcrumb={<Link href="/fazendas" className="hover:text-ink">Fazendas</Link>}
        subtitle={
          [fazenda.municipio, fazenda.estado].filter(Boolean).join(" – ") || undefined
        }
        actions={
          <>
            <ConfirmDeleteButton action={excluirFazendaAction.bind(null, id)} />
            <Link href={`/fazendas/${id}/editar`}>
              <Button variant="secondary" size="sm">
                <Pencil size={16} /> Editar
              </Button>
            </Link>
          </>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/fazendas/${id}?tab=${t.id}`}
            className={
              "border-b-2 px-4 py-2.5 text-[13.5px] font-semibold transition-colors " +
              (aba === t.id
                ? "border-primary-500 text-ink"
                : "border-transparent text-muted hover:text-ink")
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {aba === "visao" ? (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardContent className="pt-5">
              <FieldMapPlaceholder
                talhoes={talhoes.map((t) => ({
                  codigo: t.codigo,
                  tom: TOM_HEX[statusTalhao[t.status].tom] ?? TOM_HEX.green,
                }))}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardContent className="grid grid-cols-2 gap-4 pt-5">
                <Info icon={<Ruler size={16} />} label="Área total" value={fazenda.areaTotal ? formatHa(Number(fazenda.areaTotal)) : "—"} />
                <Info icon={<Ruler size={16} />} label="Área produtiva" value={fazenda.areaProdutiva ? formatHa(Number(fazenda.areaProdutiva)) : "—"} />
                <Info icon={<Grid2x2 size={16} />} label="Talhões" value={String(talhoes.length)} />
                <Info icon={<MapPin size={16} />} label="Área em talhões" value={formatHa(areaTalhoes)} />
              </CardContent>
            </Card>

            {fazenda.produtor && (
              <Card>
                <CardContent className="pt-5">
                  <div className="text-[11px] uppercase tracking-wide text-subtle">Proprietário</div>
                  <div className="mt-1 font-semibold text-ink">{fazenda.produtor.nome}</div>
                  {fazenda.documento && <div className="mt-1 text-sm text-muted">{fazenda.documento}</div>}
                </CardContent>
              </Card>
            )}

            {fazenda.observacoes && (
              <Card>
                <CardContent className="pt-5">
                  <div className="text-[11px] uppercase tracking-wide text-subtle">Observações</div>
                  <p className="mt-1.5 text-sm text-text">{fazenda.observacoes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-ink">Talhões da fazenda</h2>
              <Link href={`/talhoes/novo?fazenda=${id}`}>
                <Button size="sm">
                  <Plus size={16} /> Novo talhão
                </Button>
              </Link>
            </div>
            {talhoes.length === 0 ? (
              <EmptyState
                icon={<Grid2x2 size={20} />}
                title="Nenhum talhão nesta fazenda"
                description="Cadastre talhões para acompanhar áreas, culturas e custos."
                action={
                  <Link href={`/talhoes/novo?fazenda=${id}`}>
                    <Button size="sm"><Plus size={16} /> Novo talhão</Button>
                  </Link>
                }
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Código</Th>
                    <Th>Nome</Th>
                    <Th className="text-right">Área</Th>
                    <Th>Cultura</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {talhoes.map((t) => {
                    const st = statusTalhao[t.status];
                    return (
                      <Tr key={t.id}>
                        <Td className="font-bold text-ink">
                          <Link href={`/talhoes/${t.id}`} className="hover:text-primary-600">{t.codigo}</Link>
                        </Td>
                        <Td>{t.nome ?? "—"}</Td>
                        <Td className="tnum text-right">{formatHa(Number(t.area))}</Td>
                        <Td>{t.culturaAtual?.nome ?? "—"}</Td>
                        <Td><Badge tom={st.tom}>{st.label}</Badge></Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted">{icon}<span className="text-[12px]">{label}</span></div>
      <div className="tnum mt-1 text-lg font-bold text-ink">{value}</div>
    </div>
  );
}
