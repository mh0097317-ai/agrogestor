"use server";

import { revalidatePath } from "next/cache";
import { getCtx } from "@/modules/shared/context";
import { requirePermissao } from "@/modules/auth/guard";
import { culturaSchema, criarCultura, excluirCultura } from "./index";

export interface FormState {
  erro?: string;
  ok?: boolean;
}

export async function criarCulturaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermissao("culturas.editar");
  const parsed = culturaSchema.safeParse({
    nome: formData.get("nome"),
    unidadeProducao: formData.get("unidadeProducao"),
    cicloDias: formData.get("cicloDias"),
    cor: formData.get("cor"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  try {
    await criarCultura(await getCtx(), parsed.data);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
  revalidatePath("/culturas");
  return { ok: true };
}

export async function excluirCulturaAction(id: string): Promise<void> {
  await requirePermissao("culturas.editar");
  await excluirCultura(await getCtx(), id);
  revalidatePath("/culturas");
}
