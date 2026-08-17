import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/modules/shared/audit";
import type { Ctx } from "@/modules/shared/context";

export const culturaSchema = z.object({
  nome: z.string().min(2, "Informe o nome da cultura"),
  unidadeProducao: z.string().min(1).default("sc"),
  cicloDias: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().int().positive().optional(),
  ),
  cor: z.string().optional(),
});
export type CulturaInput = z.infer<typeof culturaSchema>;

export function listarCulturas(tenantId: string) {
  return prisma.cultura.findMany({
    where: { tenantId, deletadoEm: null },
    orderBy: { nome: "asc" },
    include: { _count: { select: { talhoes: { where: { deletadoEm: null } } } } },
  });
}

export async function criarCultura(ctx: Ctx, input: CulturaInput) {
  const existe = await prisma.cultura.findFirst({
    where: { tenantId: ctx.tenantId, nome: input.nome.trim(), deletadoEm: null },
  });
  if (existe) throw new Error("Já existe uma cultura com esse nome.");

  return prisma.$transaction(async (tx) => {
    const cultura = await tx.cultura.create({
      data: {
        tenantId: ctx.tenantId,
        nome: input.nome.trim(),
        unidadeProducao: input.unidadeProducao || "sc",
        cicloDias: input.cicloDias ?? null,
        cor: input.cor || null,
      },
    });
    await registrarAuditoria(tx, {
      tenantId: ctx.tenantId,
      usuarioId: ctx.userId,
      acao: "CRIAR",
      entidade: "Cultura",
      registroId: cultura.id,
      valorNovo: { nome: cultura.nome },
    });
    return cultura;
  });
}

export async function excluirCultura(ctx: Ctx, id: string) {
  const atual = await prisma.cultura.findFirst({ where: { id, tenantId: ctx.tenantId, deletadoEm: null } });
  if (!atual) throw new Error("Cultura não encontrada.");
  await prisma.cultura.update({ where: { id }, data: { deletadoEm: new Date() } });
}
