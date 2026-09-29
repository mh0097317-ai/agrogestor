import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { minParaHora } from "@/lib/tempo";
import { exigirSessao } from "@/modules/auth/guard";
import { GerenciarEquipe } from "@/components/painel/equipe";

export const metadata: Metadata = { title: "Equipe" };

export default async function PaginaEquipe() {
  const { negocio } = await exigirSessao();
  const [profissionais, servicos, horarios] = await Promise.all([
    prisma.profissional.findMany({
      where: { negocioId: negocio.id },
      include: { jornadas: { orderBy: { inicioMin: "asc" } }, servicos: { select: { id: true } } },
      orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { createdAt: "asc" }],
    }),
    prisma.servico.findMany({ where: { negocioId: negocio.id, ativo: true }, orderBy: [{ ordem: "asc" }] }),
    prisma.horarioFuncionamento.findMany({ where: { negocioId: negocio.id }, orderBy: { inicioMin: "asc" } }),
  ]);

  const faixa = (j: { diaSemana: number; inicioMin: number; fimMin: number }) => ({
    diaSemana: j.diaSemana,
    inicio: minParaHora(j.inicioMin),
    fim: minParaHora(j.fimMin),
  });

  return (
    <GerenciarEquipe
      horarioPadrao={horarios.map(faixa)}
      servicos={servicos.map((s) => ({ id: s.id, nome: s.nome }))}
      profissionais={profissionais.map((p) => ({
        id: p.id,
        nome: p.nome,
        bio: p.bio ?? "",
        cor: p.cor,
        ativo: p.ativo,
        servicos: p.servicos.map((s) => s.id),
        jornada: p.jornadas.map(faixa),
      }))}
    />
  );
}
