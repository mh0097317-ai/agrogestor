import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { DomainError } from "@/lib/availability";
import { requirePlatformAdmin, demoSlugs } from "./platform";
import { aiVaultView } from "./admin-vault";
import { audioVaultView } from "./assistant/audio-vault";
import { isDemo, readDemo, mutateDemo } from "./server-demo";
import { assistantSchema } from "./assistant/workspace";
import { readProfessionalLinks, readWhatsAppLink } from "./whatsapp/link";
import type { ManualInvoice } from "@/types";

export const manualInvoiceSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    id: z.uuid(),
    value: z.number().positive().max(100000),
    dueDate: z.iso.date(),
    method: z.enum(["pix", "cash", "card", "transfer", "other"]),
    note: z.string().trim().max(500),
    days: z.number().int().min(1).max(366),
  }),
  z.object({
    action: z.literal("pay"),
    id: z.uuid(),
    paidAt: z.iso
      .datetime({ offset: true })
      .refine(
        (date) => Date.parse(date) <= Date.now(),
        "A data do pagamento não pode estar no futuro.",
      ),
    renew: z.boolean(),
  }),
  z.object({ action: z.literal("cancel"), id: z.uuid() }),
]);
export async function manualInvoices(
  businessId: string,
): Promise<ManualInvoice[]> {
  if (isDemo()) return [];
  const { data, error } = await createSupabaseAdmin()
    .from("platform_manual_invoices")
    .select(
      "id,value,due_date,status,method,note,period_days,paid_at,created_at",
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error)
    throw new DomainError("Não foi possível consultar os pagamentos.", 503);
  return (data || []).map((i) => ({
    id: i.id,
    value: Number(i.value),
    dueDate: i.due_date,
    status: i.status,
    method: i.method,
    note: i.note,
    days: i.period_days,
    paidAt: i.paid_at,
    createdAt: i.created_at,
  }));
}
async function demoStore(businessId: string) {
  for (const slug of await demoSlugs()) {
    const store = await readDemo(slug);
    if (store.business.id === businessId) return { store, slug };
  }
  throw new DomainError("Estabelecimento não encontrado.", 404);
}
export async function adminClientConfig(businessId: string) {
  await requirePlatformAdmin();
  z.uuid().parse(businessId);
  if (isDemo()) {
    const { store } = await demoStore(businessId);
    return {
      settings: {
        assistantEnabled: store.settings.assistantEnabled,
        assistantName: store.settings.assistantName,
        assistantInstructions: store.settings.assistantInstructions,
        assistantDailyLimit: store.settings.assistantDailyLimit,
      },
      vault: { configured: false },
      audioVault: { configured: false },
      professionals: store.professionals.map((p) => ({
        id: p.id,
        name: p.name,
        active: p.active,
      })),
      shop: store.whatsappLink || null,
      links: [],
      invoices: [],
    };
  }
  const admin = createSupabaseAdmin();
  const [settings, professionals, vault, shop, links, invoices] =
    await Promise.all([
      admin
        .from("business_settings")
        .select(
          "assistant_enabled,assistant_name,assistant_instructions,assistant_daily_limit",
        )
        .eq("business_id", businessId)
        .maybeSingle(),
      admin
        .from("professionals")
        .select("id,name,active")
        .eq("business_id", businessId)
        .order("name"),
      aiVaultView(businessId),
      readWhatsAppLink(businessId),
      readProfessionalLinks(businessId),
      manualInvoices(businessId),
    ]);
  if (settings.error || professionals.error)
    throw new DomainError("Não foi possível consultar as configurações.", 503);
  if (!settings.data)
    throw new DomainError("Estabelecimento não encontrado.", 404);
  const s = settings.data;
  return {
    settings: {
      assistantEnabled: s.assistant_enabled,
      assistantName: s.assistant_name,
      assistantInstructions: s.assistant_instructions,
      assistantDailyLimit: s.assistant_daily_limit,
    },
    vault,
    audioVault: await audioVaultView(businessId),
    professionals: professionals.data || [],
    shop,
    links,
    invoices,
  };
}
export async function saveAdminAssistant(
  businessId: string,
  input: z.infer<typeof assistantSchema>,
) {
  const { userId } = await requirePlatformAdmin();
  if (isDemo()) {
    const { slug } = await demoStore(businessId);
    return mutateDemo((store) => Object.assign(store.settings, input), slug);
  }
  const { error } = await createSupabaseAdmin().rpc("platform_save_assistant", {
    p_business_id: businessId,
    p_actor: userId,
    p_enabled: input.assistantEnabled,
    p_name: input.assistantName,
    p_instructions: input.assistantInstructions,
    p_limit: input.assistantDailyLimit,
  });
  if (error)
    throw new DomainError(
      error.message.includes("module")
        ? "Libere o módulo Recepcionista antes de ativar."
        : "Não foi possível salvar a recepcionista.",
      409,
    );
}
export async function updateManualInvoice(
  businessId: string,
  input: z.infer<typeof manualInvoiceSchema>,
) {
  const { userId } = await requirePlatformAdmin();
  if (isDemo())
    throw new DomainError(
      "O registro de pagamentos reais é feito no ambiente publicado.",
      409,
    );
  const { error } = await createSupabaseAdmin().rpc("platform_manual_billing", {
    p_business_id: businessId,
    p_actor: userId,
    p_action: input.action,
    p_id: input.id,
    ...(input.action === "create"
      ? {
          p_value: input.value,
          p_due: input.dueDate,
          p_method: input.method,
          p_note: input.note,
          p_days: input.days,
        }
      : {}),
    ...(input.action === "pay"
      ? { p_paid_at: input.paidAt, p_renew: input.renew }
      : {}),
  });
  if (error)
    throw new DomainError("Não foi possível registrar o pagamento.", 409);
}
