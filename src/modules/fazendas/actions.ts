"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCtx } from "@/modules/shared/context";
import { requirePermissao } from "@/modules/auth/guard";
import { fazendaSchema } from "./schemas";
import { criarFazenda, atualizarFazenda, excluirFazenda } from "./service";

export interface FormState {
  erro?: string;
}

function parse(formData: FormData) {
  return fazendaSchema.safeParse({
    nome: formData.get("nome"),
    produtorNome: formData.get("produtorNome"),
    documento: formData.get("documento"),
    municipio: formData.get("municipio"),
    estado: formData.get("estado"),
    areaTotal: formData.get("areaTotal"),
    areaProdutiva: formData.get("areaProdutiva"),
    observacoes: formData.get("observacoes"),
  });
}

export async function criarFazendaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermissao("fazendas.editar");
  const parsed = parse(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const ctx = await getCtx();
  const fazenda = await criarFazenda(ctx, parsed.data);
  revalidatePath("/fazendas");
  redirect(`/fazendas/${fazenda.id}`);
}

export async function atualizarFazendaAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermissao("fazendas.editar");
  const parsed = parse(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const ctx = await getCtx();
  await atualizarFazenda(ctx, id, parsed.data);
  revalidatePath("/fazendas");
  revalidatePath(`/fazendas/${id}`);
  redirect(`/fazendas/${id}`);
}

export async function excluirFazendaAction(id: string): Promise<void> {
  await requirePermissao("fazendas.editar");
  const ctx = await getCtx();
  await excluirFazenda(ctx, id);
  revalidatePath("/fazendas");
  redirect("/fazendas");
}
