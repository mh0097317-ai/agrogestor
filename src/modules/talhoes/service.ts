import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/modules/shared/audit";
import type { Ctx } from "@/modules/shared/context";
import type { TalhaoInput } from "./schemas";

export function listarTalhoes(tenantId: string, fazendaId?: string) {
  return prisma.talhao.findMany({
    where: { tenantId, deletadoEm: null, ...(fazendaId ? { fazendaId } : {}) },
    orderBy: [{ fazenda: { nome: "asc" } }, { codigo: "asc" }],
    include: { fazenda: true, culturaAtual: true },
  });
}

export function obterTalhao(tenantId: string, id: string) {
  return prisma.talhao.findFirst({
    where: { id, tenantId, deletadoEm: null },
    include: { fazenda: true, culturaAtual: true },
  });
}

async function validarFazenda(tenantId: string, fazendaId: string) {
  const f = await prisma.fazenda.findFirst({ where: { id: fazendaId, tenantId, deletadoEm: null } });
  if (!f) throw new Error("Fazenda inválida.");
}

function toData(input: TalhaoInput) {
  return {
    codigo: input.codigo.trim().toUpperCase(),
    nome: input.nome?.trim() || null,
    area: input.area,
    culturaAtualId: input.culturaAtualId || null,
    status: input.status,
  };
}

export async function criarTalhao(ctx: Ctx, input: TalhaoInput) {
  await validarFazenda(ctx.tenantId, input.fazendaId);

  const dup = await prisma.talhao.findFirst({
    where: {
      tenantId: ctx.tenantId,
      fazendaId: input.fazendaId,
      codigo: input.codigo.trim().toUpperCase(),
      deletadoEm: null,
    },
  });
  if (dup) throw new Error("Já existe um talhão com esse código nesta fazenda.");

  return prisma.$transaction(async (tx) => {
    const talhao = await tx.talhao.create({
      data: { tenantId: ctx.tenantId, fazendaId: input.fazendaId, ...toData(input) },
    });
    await registrarAuditoria(tx, {
      tenantId: ctx.tenantId,
      usuarioId: ctx.userId,
      acao: "CRIAR",
      entidade: "Talhao",
      registroId: talhao.id,
      valorNovo: { codigo: talhao.codigo },
    });
    return talhao;
  });
}

export async function atualizarTalhao(ctx: Ctx, id: string, input: TalhaoInput) {
  const atual = await prisma.talhao.findFirst({ where: { id, tenantId: ctx.tenantId, deletadoEm: null } });
  if (!atual) throw new Error("Talhão não encontrado.");
  await validarFazenda(ctx.tenantId, input.fazendaId);

  return prisma.$transaction(async (tx) => {
    const talhao = await tx.talhao.update({
      where: { id },
      data: { fazendaId: input.fazendaId, ...toData(input) },
    });
    await registrarAuditoria(tx, {
      tenantId: ctx.tenantId,
      usuarioId: ctx.userId,
      acao: "ATUALIZAR",
      entidade: "Talhao",
      registroId: id,
      valorAnterior: { codigo: atual.codigo, status: atual.status },
      valorNovo: { codigo: talhao.codigo, status: talhao.status },
    });
    return talhao;
  });
}

export async function excluirTalhao(ctx: Ctx, id: string) {
  const atual = await prisma.talhao.findFirst({ where: { id, tenantId: ctx.tenantId, deletadoEm: null } });
  if (!atual) throw new Error("Talhão não encontrado.");
  await prisma.$transaction(async (tx) => {
    await tx.talhao.update({ where: { id }, data: { deletadoEm: new Date() } });
    await registrarAuditoria(tx, {
      tenantId: ctx.tenantId,
      usuarioId: ctx.userId,
      acao: "EXCLUIR",
      entidade: "Talhao",
      registroId: id,
      valorAnterior: { codigo: atual.codigo },
    });
  });
}
