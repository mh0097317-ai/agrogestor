import "server-only";
import { requireSession } from "@/modules/auth/guard";

export interface Ctx {
  tenantId: string;
  userId: string;
}

/** Contexto autenticado (tenant + usuário) para os services. */
export async function getCtx(): Promise<Ctx> {
  const s = await requireSession();
  return { tenantId: s.tenantId, userId: s.userId };
}
