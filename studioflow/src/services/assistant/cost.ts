import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  budgetState,
  costSummary,
  monthStart,
  type BudgetState,
  type CostSummary,
  type ModelUsage,
} from "@/lib/ai-cost";
import { isDemo } from "../server-demo";
import { businessAiCredential } from "../admin-vault";
import { businessAiTier, tierModel } from "./ai-tier";
import { receptionistModel, receptionistV3 } from "./receptionist";

/**
 * Modelo a que os tokens são atribuídos. A recepcionista v3 fixa o modelo;
 * fora dela vale o modelo do cofre da casa ou o do modo de IA. Estimativa
 * para custo, não registro de cada chamada.
 */
export async function effectiveModel(businessId: string, simulate = false) {
  if (receptionistV3(simulate)) return receptionistModel;
  const credential = await businessAiCredential(businessId).catch(() => null);
  if (credential?.model) return credential.model as string;
  return tierModel(await businessAiTier(businessId));
}

export async function recordModelTokens(
  businessId: string,
  model: string,
  input: number,
  output: number,
) {
  if (isDemo() || (!input && !output)) return;
  await createSupabaseAdmin()
    .rpc("assistant_add_model_tokens", {
      p_business_id: businessId,
      p_model: model,
      p_input: input,
      p_output: output,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

export async function usdBrlRate(): Promise<number | null> {
  if (isDemo()) return null;
  const { data } = await createSupabaseAdmin()
    .from("platform_settings")
    .select("usd_brl")
    .eq("id", "default")
    .maybeSingle();
  const rate = Number(data?.usd_brl);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export interface BusinessAiCost extends CostSummary {
  businessId: string;
  from: string;
  budgetCents: number | null;
  state: BudgetState;
}

/** Consumo do mês corrente por casa (ou de todas, para o /admin). */
export async function aiCosts(businessId?: string): Promise<BusinessAiCost[]> {
  const from = monthStart();
  if (isDemo()) return [];
  const admin = createSupabaseAdmin();
  let usage = admin
    .from("assistant_model_usage")
    .select("business_id,model,input_tokens,output_tokens")
    .gte("day", from);
  let plans = admin.from("business_ai_plan").select("business_id,monthly_budget_cents");
  if (businessId) {
    usage = usage.eq("business_id", businessId);
    plans = plans.eq("business_id", businessId);
  }
  const [rows, budgets, rate] = await Promise.all([usage, plans, usdBrlRate()]);
  const byBusiness = new Map<string, ModelUsage[]>();
  for (const row of rows.data || []) {
    const list = byBusiness.get(row.business_id as string) || [];
    list.push({
      model: row.model as string,
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
    });
    byBusiness.set(row.business_id as string, list);
  }
  const budgetOf = new Map(
    (budgets.data || []).map((b) => [b.business_id as string, b.monthly_budget_cents as number | null]),
  );
  const ids = new Set([...byBusiness.keys(), ...budgetOf.keys(), ...(businessId ? [businessId] : [])]);
  return [...ids].map((id) => {
    const summary = costSummary(byBusiness.get(id) || [], rate);
    const budgetCents = budgetOf.get(id) ?? null;
    return {
      businessId: id,
      from,
      budgetCents,
      state: budgetState(summary.brlCents, budgetCents),
      ...summary,
    };
  });
}

/** false = teto mensal estourado: a recepcionista pausa e a equipe assume. */
export async function withinAiBudget(businessId: string) {
  if (isDemo()) return true;
  try {
    const [cost] = await aiCosts(businessId);
    return cost?.state !== "over";
  } catch {
    // Sem consulta não bloqueia: o teto diário de respostas continua valendo.
    return true;
  }
}

export async function saveAiBudget(businessId: string, actor: string | null, cents: number | null) {
  const { error } = await createSupabaseAdmin()
    .from("business_ai_plan")
    .upsert({
      business_id: businessId,
      monthly_budget_cents: cents,
      updated_by: actor,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error("budget-save-failed");
}

export async function saveUsdBrl(actor: string | null, rate: number | null) {
  const { error } = await createSupabaseAdmin()
    .from("platform_settings")
    .upsert({ id: "default", usd_brl: rate, updated_by: actor, updated_at: new Date().toISOString() });
  if (error) throw new Error("rate-save-failed");
}
