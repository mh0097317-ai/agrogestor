import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isDemo } from "../server-demo";
import { assistantModel } from "./agent";

/*
 * Modo da IA de cada cliente, escolhido no /admin. Vale para quem usa a
 * chave da StudioFlow; cliente com chave própria segue o modelo do Cofre.
 * A recepcionista força ferramentas de agenda (tool_choice), por isso os
 * modos usam modelos que aceitam isso sem pensamento ligado por padrão.
 */
export const aiTiers = ["economico", "equilibrado", "maximo"] as const;
export type AiTier = (typeof aiTiers)[number];
export const aiTierSchema = z.object({ tier: z.enum(aiTiers) });

export function tierModel(tier: AiTier) {
  if (tier === "maximo") return "claude-opus-4-8";
  if (tier === "equilibrado") return "claude-sonnet-4-6";
  return assistantModel;
}

/** Sem registro ou com o banco fora do ar, fica no mais barato. */
export async function businessAiTier(businessId: string): Promise<AiTier> {
  if (isDemo()) return "economico";
  try {
    const { data } = await createSupabaseAdmin()
      .from("business_ai_plan")
      .select("tier")
      .eq("business_id", businessId)
      .maybeSingle();
    const tier = data?.tier as AiTier | undefined;
    return tier && aiTiers.includes(tier) ? tier : "economico";
  } catch {
    return "economico";
  }
}

export async function saveAiTier(
  businessId: string,
  actor: string | null,
  tier: AiTier,
) {
  if (isDemo())
    throw new DomainError(
      "O modo da IA é trocado somente no ambiente publicado.",
      409,
    );
  const { error } = await createSupabaseAdmin()
    .from("business_ai_plan")
    .upsert({
      business_id: businessId,
      tier,
      updated_by: actor,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new DomainError("Não foi possível trocar o modo da IA.", 503);
}
