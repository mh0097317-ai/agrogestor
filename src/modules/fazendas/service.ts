import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/modules/shared/audit";
import type { Ctx } from "@/modules/shared/context";
import type { FazendaInput } from "./schemas";

export function listarFazendas(tenantId: string) {
  return prisma.fazenda.findMany({
    where: { tenantId, deletadoEm: null },
    orderBy: { nome: "asc" },
    include: {
      produtor: true,
      _count: { select: { talhoes: { where: { deletadoEm: null } } } },
    },
  });
}

export async function obterFazenda(tenantId: string, id: string) {
  return prisma.fazenda.findFirst({
    where: { id, tenantId, deletadoEm: null },
    include: {
      produtor: true,
      talhoes: {
        where: { deletadoEm: null },
        orderBy: { codigo: "asc" },
        include: { culturaAtual: true },
      },
    },
  });
}

function toData(input: FazendaInput) {
  const estado = input.estado?.trim() ? input.estado.trim().toUpperCase() : null;
  return {
    nome: input.nome.trim(),
    documento: input.documento?.trim() || null,
    municipio: input.municipio?.trim() || null,
    estado,
    areaTotal: input.areaTotal ?? null,
    areaProdutiva: input.areaProdutiva ?? null,
    observacoes: input.observacoes?.trim() || null,
  };
}

export async function criarFazenda(ctx: Ctx, input: FazendaInput) {
  return prisma.$transaction(async (tx) => {
    let produtorId: string | null = null;
    if (input.produtorNome?.trim()) {
      const produtor = await tx.produtor.create({
        data: { tenantId: ctx.tenantId, nome: input.produtorNome.trim() },
      });
      produtorId = produtor.id;
    }

    const fazenda = await tx.fazenda.create({
      data: { tenantId: ctx.tenantId, produtorId, ...toData(input) },
    });

    await registrarAuditoria(tx, {
      tenantId: ctx.tenantId,
      usuarioId: ctx.userId,
      acao: "CRIAR",
      entidade: "Fazenda",
      registroId: fazenda.id,
      valorNovo: { nome: fazenda.nome },
    });
    return fazenda;
  });
}

export async function atualizarFazenda(ctx: Ctx, id: string, input: FazendaInput) {
  const atual = await prisma.fazenda.findFirst({ where: { id, tenantId: ctx.tenantId, deletadoEm: null } });
  if (!atual) throw new Error("Fazenda não encontrada.");

  return prisma.$transaction(async (tx) => {
    const fazenda = await tx.fazenda.update({
      where: { id },
      data: toData(input),
    });
    await registrarAuditoria(tx, {
      tenantId: ctx.tenantId,
      usuarioId: ctx.userId,
      acao: "ATUALIZAR",
      entidade: "Fazenda",
      registroId: id,
      valorAnterior: { nome: atual.nome },
      valorNovo: { nome: fazenda.nome },
    });
    return fazenda;
  });
}

export async function excluirFazenda(ctx: Ctx, id: string) {
  const atual = await prisma.fazenda.findFirst({ where: { id, tenantId: ctx.tenantId, deletadoEm: null } });
  if (!atual) throw new Error("Fazenda não encontrada.");
  return prisma.$transaction(async (tx) => {
    await tx.fazenda.update({ where: { id }, data: { deletadoEm: new Date() } });
    await registrarAuditoria(tx, {
      tenantId: ctx.tenantId,
      usuarioId: ctx.userId,
      acao: "EXCLUIR",
      entidade: "Fazenda",
      registroId: id,
      valorAnterior: { nome: atual.nome },
    });
  });
}
