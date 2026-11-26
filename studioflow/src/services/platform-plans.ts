import { randomUUID } from "node:crypto";
import { createSupabaseAdmin, requireMembership } from "@/lib/supabase/server";
import { DomainError } from "@/lib/availability";
import {
  defaultPlans,
  planInputSchema,
  subscriptionRequestSchema,
  type PlatformPlan,
  type SubscriptionRequest,
} from "@/lib/platform-plans";
import type { ModuleKey } from "@/lib/modules";
import { isDemo, mutateDemo, readDemo } from "./server-demo";
import { demoSlugs, platformPlan, requirePlatformAdmin } from "./platform";
import { cancelPlatformSubscription } from "./billing";

type PlanRow = {
  key: string;
  name: string;
  tagline: string;
  monthly_cents: number | null;
  annual_cents: number | null;
  modules: string[];
  highlight: boolean;
  active?: boolean;
  sort: number;
};
const fromRow = (row: PlanRow): PlatformPlan => ({
  key: row.key,
  name: row.name,
  tagline: row.tagline,
  monthlyCents: row.monthly_cents,
  annualCents: row.annual_cents,
  modules: row.modules as ModuleKey[],
  highlight: row.highlight,
  active: row.active,
  sort: row.sort,
});

/** Vitrine pública: só planos ativos. Se o banco falhar, os padrões (sem preço). */
export async function publicPlans(): Promise<PlatformPlan[]> {
  if (isDemo()) return defaultPlans;
  try {
    const { data, error } = await createSupabaseAdmin()
      .from("platform_plans")
      .select("key,name,tagline,monthly_cents,annual_cents,modules,highlight,sort")
      .eq("active", true)
      .order("sort");
    if (error || !data?.length) return defaultPlans;
    return (data as PlanRow[]).map(fromRow);
  } catch {
    // Sem banco configurado (build ou falha de conexão): vitrine sem preço.
    return defaultPlans;
  }
}

/** /admin: todos os planos, inclusive inativos. */
export async function adminPlans(): Promise<PlatformPlan[]> {
  await requirePlatformAdmin();
  if (isDemo()) return defaultPlans.map((p) => ({ ...p, active: true }));
  const { data, error } = await createSupabaseAdmin()
    .from("platform_plans")
    .select("key,name,tagline,monthly_cents,annual_cents,modules,highlight,active,sort")
    .order("sort");
  if (error) throw new DomainError("Não foi possível ler os planos.", 503);
  return (data as PlanRow[]).map(fromRow);
}

export async function savePlan(input: unknown) {
  const { userId } = await requirePlatformAdmin();
  const plan = planInputSchema.parse(input);
  if (isDemo())
    throw new DomainError("Os preços são definidos no ambiente publicado.", 409);
  const { error } = await createSupabaseAdmin()
    .from("platform_plans")
    .upsert({
      key: plan.key,
      name: plan.name,
      tagline: plan.tagline,
      monthly_cents: plan.monthlyCents,
      annual_cents: plan.annualCents,
      modules: [...new Set(plan.modules)].sort(),
      highlight: plan.highlight,
      active: plan.active,
      sort: plan.sort,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });
  if (error) throw new DomainError("Não foi possível salvar o plano.", 409);
}

type RequestRow = {
  id: string;
  business_id: string;
  kind: SubscriptionRequest["kind"];
  to_plan: string | null;
  reason: string;
  status: SubscriptionRequest["status"];
  resolution_note: string;
  created_at: string;
  resolved_at: string | null;
  businesses?: { name: string } | null;
};
const requestFromRow = (row: RequestRow): SubscriptionRequest => ({
  id: row.id,
  businessId: row.business_id,
  businessName: row.businesses?.name,
  kind: row.kind,
  toPlan: row.to_plan,
  reason: row.reason,
  status: row.status,
  resolutionNote: row.resolution_note,
  createdAt: row.created_at,
  resolvedAt: row.resolved_at,
});

/** O dono pede: a equipe aplica no /admin. Nada muda de preço sozinho. */
export async function requestSubscriptionChange(input: unknown) {
  const request = subscriptionRequestSchema.parse(input);
  if (request.kind === "change_plan") {
    const plans = await publicPlans();
    if (!plans.some((p) => p.key === request.toPlan))
      throw new DomainError("Escolha um plano disponível.");
  }
  if (isDemo())
    return mutateDemo((store) => {
      // A demonstração abre como dono (sem login).
      if (store.viewer && !["owner", "admin"].includes(store.viewer.role))
        throw new DomainError("Só o dono pode mudar a assinatura.", 403);
      const open = (store.subscriptionRequests || []).find((r) => r.status === "pending");
      if (open) throw new DomainError("Já existe um pedido em análise.", 409);
      const row: SubscriptionRequest = {
        id: randomUUID(),
        businessId: store.business.id,
        kind: request.kind,
        toPlan: request.kind === "change_plan" ? request.toPlan : null,
        reason: request.reason,
        status: "pending",
        resolutionNote: "",
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };
      store.subscriptionRequests = [...(store.subscriptionRequests || []), row].slice(-20);
      return row;
    });
  const { businessId, role, user } = await requireMembership({ allowClosed: true });
  if (!["owner", "admin"].includes(role))
    throw new DomainError("Só o dono pode mudar a assinatura.", 403);
  const { data, error } = await createSupabaseAdmin()
    .from("platform_subscription_requests")
    .insert({
      business_id: businessId,
      kind: request.kind,
      to_plan: request.kind === "change_plan" ? request.toPlan : null,
      reason: request.reason,
      requested_by: user.id,
    })
    .select("id,business_id,kind,to_plan,reason,status,resolution_note,created_at,resolved_at")
    .single();
  if (error)
    throw new DomainError(
      error.code === "23505"
        ? "Já existe um pedido em análise."
        : "Não foi possível registrar o pedido.",
      409,
    );
  return requestFromRow(data as RequestRow);
}

/** Pedidos da própria casa (Configurações → Plano). */
export async function ownSubscriptionRequests(): Promise<SubscriptionRequest[]> {
  if (isDemo()) return (await readDemo()).subscriptionRequests || [];
  const { businessId } = await requireMembership({ allowClosed: true });
  const { data } = await createSupabaseAdmin()
    .from("platform_subscription_requests")
    .select("id,business_id,kind,to_plan,reason,status,resolution_note,created_at,resolved_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(10);
  return ((data || []) as RequestRow[]).map(requestFromRow);
}

export async function withdrawSubscriptionRequest() {
  if (isDemo())
    return mutateDemo((store) => {
      store.subscriptionRequests = (store.subscriptionRequests || []).map((r) =>
        r.status === "pending" ? { ...r, status: "withdrawn" as const, resolvedAt: new Date().toISOString() } : r,
      );
    });
  const { businessId, role } = await requireMembership({ allowClosed: true });
  if (!["owner", "admin"].includes(role))
    throw new DomainError("Só o dono pode mudar a assinatura.", 403);
  await createSupabaseAdmin()
    .from("platform_subscription_requests")
    .update({ status: "withdrawn", resolved_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("status", "pending");
}

/** /admin: fila de pedidos. */
export async function adminSubscriptionRequests(): Promise<SubscriptionRequest[]> {
  await requirePlatformAdmin();
  if (isDemo()) {
    const all: SubscriptionRequest[] = [];
    for (const slug of await demoSlugs()) {
      const store = await readDemo(slug);
      for (const r of store.subscriptionRequests || [])
        all.push({ ...r, businessName: store.business.name });
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { data, error } = await createSupabaseAdmin()
    .from("platform_subscription_requests")
    .select("id,business_id,kind,to_plan,reason,status,resolution_note,created_at,resolved_at,businesses(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new DomainError("Não foi possível ler os pedidos.", 503);
  return ((data || []) as unknown as RequestRow[]).map(requestFromRow);
}

/**
 * Aplicar troca de plano usa o mesmo caminho do /admin (módulos + preço do
 * plano). Cancelamento só é registrado: suspender o acesso continua sendo
 * uma ação explícita da equipe, no fim do período pago.
 */
export async function resolveSubscriptionRequest(input: {
  id: string;
  decision: "done" | "rejected";
  note?: string;
}) {
  const { userId } = await requirePlatformAdmin();
  const note = (input.note || "").slice(0, 500);
  const requests = await adminSubscriptionRequests();
  const request = requests.find((r) => r.id === input.id && r.status === "pending");
  if (!request) throw new DomainError("Pedido não encontrado ou já resolvido.", 404);
  if (input.decision === "done" && request.kind === "change_plan") {
    const plan = (await adminPlans()).find((p) => p.key === request.toPlan);
    if (!plan) throw new DomainError("O plano pedido não existe mais.", 409);
    await platformPlan({
      businessId: request.businessId,
      plan: plan.name,
      price: plan.monthlyCents === null ? null : plan.monthlyCents / 100,
      modules: plan.modules,
    });
  }
  // Cancelamento aceito: as próximas cobranças no cartão param no Asaas.
  if (input.decision === "done" && request.kind === "cancel")
    await cancelPlatformSubscription(request.businessId);
  if (isDemo()) {
    for (const slug of await demoSlugs()) {
      const store = await readDemo(slug);
      if (store.business.id !== request.businessId) continue;
      await mutateDemo((draft) => {
        draft.subscriptionRequests = (draft.subscriptionRequests || []).map((r) =>
          r.id === request.id
            ? { ...r, status: input.decision, resolutionNote: note, resolvedAt: new Date().toISOString() }
            : r,
        );
      }, slug);
    }
    return;
  }
  const { error } = await createSupabaseAdmin()
    .from("platform_subscription_requests")
    .update({
      status: input.decision,
      resolution_note: note,
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("status", "pending");
  if (error) throw new DomainError("Não foi possível resolver o pedido.", 409);
}
