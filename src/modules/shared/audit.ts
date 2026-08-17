import "server-only";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** Registra uma ação de auditoria. Chamar dentro dos services. */
export async function registrarAuditoria(
  tx: Tx,
  params: {
    tenantId: string;
    usuarioId?: string;
    acao: string;
    entidade: string;
    registroId?: string;
    valorAnterior?: unknown;
    valorNovo?: unknown;
  },
) {
  await tx.auditLog.create({
    data: {
      tenantId: params.tenantId,
      usuarioId: params.usuarioId,
      acao: params.acao,
      entidade: params.entidade,
      registroId: params.registroId,
      valorAnterior: (params.valorAnterior ?? undefined) as Prisma.InputJsonValue | undefined,
      valorNovo: (params.valorNovo ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
