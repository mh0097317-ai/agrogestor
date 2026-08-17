import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Grid2x2 } from "lucide-react";
import { requireSession } from "@/modules/auth/guard";
import { listarTalhoes } from "@/modules/talhoes/service";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { statusTalhao } from "@/lib/status";
import { formatHa } from "@/lib/utils";

export const metadata: Metadata = { title: "Talhões" };

export default async function TalhoesPage() {
  const session = await requireSession();
  const talhoes = await listarTalhoes(session.tenantId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Talhões"
        subtitle="Áreas de plantio das suas fazendas."
        actions={
          <Link href="/talhoes/novo">
            <Button><Plus size={18} /> Novo talhão</Button>
          </Link>
        }
      />

      {talhoes.length === 0 ? (
        <EmptyState
          icon={<Grid2x2 size={22} />}
          title="Nenhum talhão cadastrado"
          description="Cadastre talhões para acompanhar áreas, culturas, produção e custos."
          action={<Link href="/talhoes/novo"><Button><Plus size={18} /> Cadastrar talhão</Button></Link>}
        />
      ) : (
        <Card>
          <CardContent className="pt-5">
            <Table>
              <thead>
                <tr>
                  <Th>Código</Th>
                  <Th>Nome</Th>
                  <Th>Fazenda</Th>
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
                      <Td className="text-muted">{t.fazenda.nome}</Td>
                      <Td className="tnum text-right">{formatHa(Number(t.area))}</Td>
                      <Td>{t.culturaAtual?.nome ?? "—"}</Td>
                      <Td><Badge tom={st.tom}>{st.label}</Badge></Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
