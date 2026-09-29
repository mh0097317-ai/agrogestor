"use server";

import { revalidatePath } from "next/cache";
import { cancelarPeloCliente, ErroAgenda } from "@/modules/agenda/service";

export async function cancelar(token: string, motivo: string): Promise<{ erro?: string }> {
  try {
    await cancelarPeloCliente(token, motivo.trim().slice(0, 200) || undefined);
  } catch (e) {
    if (e instanceof ErroAgenda) return { erro: e.message };
    console.error(e);
    return { erro: "Não foi possível cancelar agora." };
  }
  revalidatePath(`/agendamento/${token}`);
  return {};
}
