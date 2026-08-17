"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCtx } from "@/modules/shared/context";
import { requirePermissao } from "@/modules/auth/guard";
import { talhaoSchema } from "./schemas";
import { criarTalhao, atualizarTalhao, excluirTalhao } from "./service";

export interface FormState {
  erro?: string;
}

function parse(formData: FormData) {
  return talhaoSchema.safeParse({
    fazendaId: formData.get("fazendaId"),
    codigo: formData.get("codigo"),
    nome: formData.get("nome"),
    area: formData.get("area"),
    culturaAtualId: formData.get("culturaAtualId") || undefined,
    status: formData.get("status") || "DISPONIVEL",
  });
}

export async function criarTalhaoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermissao("talhoes.editar");
  const parsed = parse(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  let talhaoId: string;
  try {
    const t = await criarTalhao(await getCtx(), parsed.data);
    talhaoId = t.id;
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
  revalidatePath("/talhoes");
  redirect(`/talhoes/${talhaoId}`);
}

export async function atualizarTalhaoAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermissao("talhoes.editar");
  const parsed = parse(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  try {
    await atualizarTalhao(await getCtx(), id, parsed.data);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
  revalidatePath("/talhoes");
  revalidatePath(`/talhoes/${id}`);
  redirect(`/talhoes/${id}`);
}

export async function excluirTalhaoAction(id: string): Promise<void> {
  await requirePermissao("talhoes.editar");
  await excluirTalhao(await getCtx(), id);
  revalidatePath("/talhoes");
  redirect("/talhoes");
}
