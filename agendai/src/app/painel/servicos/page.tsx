import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/modules/auth/guard";
import { GerenciarServicos } from "@/components/painel/servicos";

export const metadata: Metadata = { title: "Serviços" };

export default async function PaginaServicos() {
  const { negocio } = await exigirSessao();
  const servicos = await prisma.servico.findMany({
    where: { negocioId: negocio.id },
    include: { _count: { select: { agendamentos: true } } },
    orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }],
  });
  return (
    <GerenciarServicos
      servicos={servicos.map((s) => ({
        id: s.id,
        nome: s.nome,
        descricao: s.descricao,
        duracaoMin: s.duracaoMin,
        precoCentavos: s.precoCentavos,
        ativo: s.ativo,
        agendamentos: s._count.agendamentos,
      }))}
    />
  );
}
