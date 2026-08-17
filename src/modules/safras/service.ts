import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/modules/shared/audit";
import type { Ctx } from "@/modules/shared/context";
import type { SafraInput } from "./schemas";
import { EtapaValues } from "./schemas";
import type { EtapaSafra, StatusEtapa } from "@prisma/client";

export function listarSafras(tenantId: string) {
  return prisma.safra.findMany({
    where: { tenantId, deletadoEm: null },
    orderBy: { criadoEm: "desc" },
    include: {
      cultura: true,
      fazenda: true,
      talhoes: true,
      _count: { select: { talhoes: true } },
    },
  });
}

export function obterSafra(tenantId: string, id: string) {
  return prisma.safra.findFirst({
    where: { id, tenantId, deletadoEm: null },
    include: {
      cultura: true,
      fazenda: true,
      etapas: { orderBy: { ordem: "asc" } },
      talhoes: { include: { talhao: { include: { fazenda: true, culturaAtual: true } } } },
    },
  });
}

/** Cálculos derivados de uma safra (área, produção, receita, resultado). */
export function calcularIndicadores(safra: {
  precoVendaPrevisto: unknown;
  produtividadeEstimada: unknown;
  talhoes: { areaPlantada: unknown }[];
}) {
  const areaPlantada = safra.talhoes.reduce((acc, t) => acc + Number(t.areaPlantada), 0);
  const prodPorHa = safra.produtividadeEstimada ? Number(safra.produtividadeEstimada) : 0;
  const preco = safra.precoVendaPrevisto ? Number(safra.precoVendaPrevisto) : 0;
  const producaoEstimada = areaPlantada * prodPorHa;
  const receitaPrevista = producaoEstimada * preco;
  const custo = 0; // Fase 3+ (operações/financeiro)
  const resultado = receitaPrevista - custo;
  const margem = receitaPrevista > 0 ? (resultado / receitaPrevista) * 100 : 0;
  return { areaPlantada, producaoEstimada, receitaPrevista, custo, resultado, margem };
}

export async function criarSafra(ctx: Ctx, input: SafraInput) {
  // valida talhões pertencem ao tenant
  const talhoes = input.talhaoIds.length
    ? await prisma.talhao.findMany({
        where: { id: { in: input.talhaoIds }, tenantId: ctx.tenantId, deletadoEm: null },
      })
    : [];

  return prisma.$transaction(async (tx) => {
    const safra = await tx.safra.create({
      data: {
        tenantId: ctx.tenantId,
        nome: input.nome.trim(),
        fazendaId: input.fazendaId || null,
        culturaId: input.culturaId || null,
        status: input.status,
        precoVendaPrevisto: input.precoVendaPrevisto ?? null,
        produtividadeEstimada: input.produtividadeEstimada ?? null,
        etapas: {
          create: EtapaValues.map((etapa, i) => ({
            tenantId: ctx.tenantId,
            etapa: etapa as EtapaSafra,
            ordem: i,
            status: (i === 0 ? "EM_ANDAMENTO" : "PENDENTE") as StatusEtapa,
          })),
        },
        talhoes: {
          create: talhoes.map((t) => ({
            tenantId: ctx.tenantId,
            talhaoId: t.id,
            areaPlantada: t.area,
          })),
        },
      },
    });

    await registrarAuditoria(tx, {
      tenantId: ctx.tenantId,
      usuarioId: ctx.userId,
      acao: "CRIAR",
      entidade: "Safra",
      registroId: safra.id,
      valorNovo: { nome: safra.nome },
    });
    return safra;
  });
}

export async function atualizarEtapa(ctx: Ctx, safraId: string, etapa: EtapaSafra, status: StatusEtapa) {
  const safra = await prisma.safra.findFirst({ where: { id: safraId, tenantId: ctx.tenantId, deletadoEm: null } });
  if (!safra) throw new Error("Safra não encontrada.");
  await prisma.safraEtapa.updateMany({
    where: { safraId, etapa, tenantId: ctx.tenantId },
    data: { status },
  });
}

export async function excluirSafra(ctx: Ctx, id: string) {
  const atual = await prisma.safra.findFirst({ where: { id, tenantId: ctx.tenantId, deletadoEm: null } });
  if (!atual) throw new Error("Safra não encontrada.");
  await prisma.$transaction(async (tx) => {
    await tx.safra.update({ where: { id }, data: { deletadoEm: new Date() } });
    await registrarAuditoria(tx, {
      tenantId: ctx.tenantId,
      usuarioId: ctx.userId,
      acao: "EXCLUIR",
      entidade: "Safra",
      registroId: id,
      valorAnterior: { nome: atual.nome },
    });
  });
}
