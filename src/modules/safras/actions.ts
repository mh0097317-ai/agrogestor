"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCtx } from "@/modules/shared/context";
import { requirePermissao } from "@/modules/auth/guard";
import { safraSchema, etapaUpdateSchema } from "./schemas";
import { criarSafra, atualizarEtapa, excluirSafra } from "./service";
import type { EtapaSafra, StatusEtapa } from "@prisma/client";

export interface FormState {
  erro?: string;
}

export async function criarSafraAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermissao("safras.editar");
  const parsed = safraSchema.safeParse({
    nome: formData.get("nome"),
    fazendaId: formData.get("fazendaId") || undefined,
    culturaId: formData.get("culturaId") || undefined,
    status: formData.get("status") || "PLANEJADA",
    precoVendaPrevisto: formData.get("precoVendaPrevisto"),
    produtividadeEstimada: formData.get("produtividadeEstimada"),
    talhaoIds: formData.getAll("talhaoIds").map(String),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  let safraId: string;
  try {
    const s = await criarSafra(await getCtx(), parsed.data);
    safraId = s.id;
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
  revalidatePath("/safras");
  redirect(`/safras/${safraId}`);
}

export async function atualizarEtapaAction(safraId: string, formData: FormData): Promise<void> {
  await requirePermissao("safras.editar");
  const parsed = etapaUpdateSchema.safeParse({
    etapa: formData.get("etapa"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;
  await atualizarEtapa(await getCtx(), safraId, parsed.data.etapa as EtapaSafra, parsed.data.status as StatusEtapa);
  revalidatePath(`/safras/${safraId}`);
  revalidatePath("/dashboard");
}

export async function excluirSafraAction(id: string): Promise<void> {
  await requirePermissao("safras.editar");
  await excluirSafra(await getCtx(), id);
  revalidatePath("/safras");
  redirect("/safras");
}
