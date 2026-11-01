import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "./platform";
import { isDemo } from "./server-demo";

/*
 * Agenda de demonstração: a casa usada nas apresentações fica com a agenda
 * cheia (21 dias para trás, 7 para frente) e se renova sozinha. Os horários
 * levam a marca "demo", sem lembrete e com os avisos já encerrados, então
 * nenhuma mensagem sai para cliente nem para barbeiro.
 */

export const demoAgendaSchema = z.object({
  businessId: z.string().uuid(),
  enabled: z.boolean(),
});

/** Cron: atualiza quem está na cadeira e completa os próximos 7 dias. */
export async function refreshDemoAgendas() {
  if (isDemo()) return 0;
  const { data, error } = await createSupabaseAdmin().rpc("refresh_demo_agendas");
  // Banco ainda sem a migração da agenda de demonstração: nada a fazer.
  if (error?.code === "PGRST202") return 0;
  if (error) throw new Error("demo agenda refresh failed");
  return (data as number) || 0;
}

export async function demoAgendaEnabled(businessId: string) {
  await requirePlatformAdmin();
  if (isDemo()) return false;
  const { data } = await createSupabaseAdmin()
    .from("business_settings")
    .select("demo_agenda")
    .eq("business_id", businessId)
    .maybeSingle();
  return data?.demo_agenda === true;
}

export async function setDemoAgenda(input: z.infer<typeof demoAgendaSchema>) {
  await requirePlatformAdmin();
  if (isDemo())
    throw new DomainError("A demonstração local já tem a agenda cheia.", 409);
  const admin = createSupabaseAdmin();
  if (!input.enabled) {
    const { data, error } = await admin.rpc("clear_demo_agenda", {
      p_business_id: input.businessId,
    });
    if (error) throw new DomainError("Não foi possível limpar a agenda de demonstração.", 503);
    return { enabled: false, changed: (data as number) || 0 };
  }
  const { error: flagError } = await admin
    .from("business_settings")
    .update({ demo_agenda: true })
    .eq("business_id", input.businessId);
  if (flagError) throw new DomainError("Não foi possível ligar a agenda de demonstração.", 503);
  const { data, error } = await admin.rpc("seed_demo_agenda", {
    p_business_id: input.businessId,
    p_days_back: 21,
    p_days_ahead: 7,
  });
  if (error) throw new DomainError("Não foi possível montar a agenda de demonstração.", 503);
  return { enabled: true, changed: (data as number) || 0 };
}
