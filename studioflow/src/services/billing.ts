import { randomUUID } from "node:crypto";
import { z } from "zod";
import { accessState, daysLeft, extendUntil, type BusinessAccess } from "@/lib/access";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin, readBusinessAccess, requireMembership } from "@/lib/supabase/server";
import { money } from "@/lib/utils";
import type { PlatformInvoice, Store } from "@/types";
import { AsaasClient, paidStatuses, type AsaasEnvironment } from "./payments/asaas";
import { isDemo, mutateDemo, readDemo } from "./server-demo";
import { demoWorkspaceSlug } from "./server-store";

/**
 * Mensalidade do StudioFlow, cobrada pela conta Asaas da própria plataforma
 * (STUDIOFLOW_ASAAS_API_KEY / STUDIOFLOW_ASAAS_ENV). Cada fatura paga soma
 * `period` dias ao acesso do estabelecimento, sem ninguém precisar liberar.
 */
const period = 30;
export const billingReady = () => !!process.env.STUDIOFLOW_ASAAS_API_KEY;
const platformAsaas = () =>
  new AsaasClient(
    process.env.STUDIOFLOW_ASAAS_API_KEY || "",
    (process.env.STUDIOFLOW_ASAAS_ENV === "sandbox" ? "sandbox" : "production") as AsaasEnvironment,
  );
const payers = ["owner", "admin", "manager"];

export interface BillingView {
  ready: boolean;
  plan: string;
  price: number | null;
  until: string | null;
  state: ReturnType<typeof accessState>;
  /** Unlimited access is not billed. */
  billable: boolean;
  document: string;
  open: PlatformInvoice | null;
  invoices: PlatformInvoice[];
}

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
/** Due date: the end of the access, or today when it already ended. */
const dueFor = (access: BusinessAccess) => {
  if (!access.until || new Date(access.until).getTime() <= Date.now()) return today();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(access.until));
};
const billable = (access: BusinessAccess) =>
  !!access.price && access.price > 0 && !(access.status === "active" && !access.until);

const row = (item: Record<string, unknown>): PlatformInvoice => ({
  id: item.id as string,
  value: Number(item.value),
  dueDate: item.due_date as string,
  status: item.status as PlatformInvoice["status"],
  invoiceUrl: (item.invoice_url as string) || "",
  paidAt: (item.paid_at as string | null) ?? null,
  createdAt: item.created_at as string,
});

function demoView(store: Store): BillingView {
  const access = store.access ?? { status: "active" as const, until: null };
  const invoices = [...(store.platformInvoices || [])].reverse();
  return {
    ready: true,
    plan: access.plan || "",
    price: access.price ?? null,
    until: access.until,
    state: accessState(access),
    billable: billable(access),
    document: store.business.cnpj || "",
    open: invoices.find((item) => item.status === "pending") || null,
    invoices: invoices.slice(0, 6),
  };
}

export async function billingView(): Promise<BillingView> {
  if (isDemo()) return demoView(await readDemo(await demoWorkspaceSlug()));
  const { businessId } = await requireMembership({ allowClosed: true });
  const admin = createSupabaseAdmin();
  const [access, business, invoices] = await Promise.all([
    readBusinessAccess(businessId),
    admin.from("businesses").select("cnpj").eq("id", businessId).single(),
    admin
      .from("platform_invoices")
      .select("id,value,due_date,status,invoice_url,paid_at,created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const list = (invoices.data || []).map(row);
  return {
    ready: billingReady(),
    plan: access.plan || "",
    price: access.price ?? null,
    until: access.until,
    state: accessState(access),
    billable: billable(access),
    document: ((business.data?.cnpj as string) || "").replace(/\D/g, ""),
    open: list.find((item) => item.status === "pending") || null,
    invoices: list,
  };
}

export const paySchema = z.object({
  document: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value === "" || value.length === 11 || value.length === 14, "Informe um CPF ou CNPJ válido.")
    .default(""),
});

/** The open invoice, created on Asaas when there is none yet. */
async function openInvoice(businessId: string, document: string, contact: { email?: string }) {
  const admin = createSupabaseAdmin();
  const access = await readBusinessAccess(businessId);
  if (!billable(access))
    throw new DomainError("Seu plano não tem mensalidade para pagar agora.", 409);
  const { data: existing } = await admin
    .from("platform_invoices")
    .select("id,value,due_date,status,invoice_url,paid_at,created_at,asaas_charge_id")
    .eq("business_id", businessId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    // Price changed meanwhile: the old one goes away and a new one is made.
    if (Number(existing.value) === access.price) return row(existing);
    await platformAsaas().deletePayment(existing.asaas_charge_id as string).catch(() => undefined);
    await admin.from("platform_invoices").update({ status: "cancelled" }).eq("id", existing.id);
  }
  const { data: business } = await admin
    .from("businesses")
    .select("name,phone,cnpj")
    .eq("id", businessId)
    .single();
  const doc = document || ((business?.cnpj as string) || "").replace(/\D/g, "");
  if (doc.length !== 11 && doc.length !== 14)
    throw new DomainError("Para emitir a cobrança, informe o CPF ou o CNPJ do responsável.", 400);
  const asaas = platformAsaas();
  const customer = await asaas.findOrCreateCustomer({
    name: business!.name,
    cpf: doc,
    phone: ((business!.phone as string) || "").replace(/\D/g, ""),
    email: contact.email,
    reference: `studioflow:${businessId}`,
  });
  const charge = await asaas.createInvoice({
    customer,
    value: access.price!,
    dueDate: dueFor(access),
    description: `StudioFlow ${access.plan || "mensalidade"} · ${business!.name} · ${period} dias`,
    reference: `studioflow-fee:${businessId}`,
  });
  const { data: saved, error } = await admin
    .from("platform_invoices")
    .insert({
      business_id: businessId,
      asaas_charge_id: charge.id,
      value: access.price,
      period_days: period,
      due_date: charge.dueDate || dueFor(access),
      invoice_url: charge.invoiceUrl || "",
    })
    .select("id,value,due_date,status,invoice_url,paid_at,created_at")
    .single();
  if (error) {
    await asaas.deletePayment(charge.id).catch(() => undefined);
    throw new DomainError("Não foi possível registrar a cobrança. Tente de novo.", 503);
  }
  // Saved for the next invoices (and the automatic reminders).
  if (document && !business?.cnpj)
    await admin.from("businesses").update({ cnpj: document }).eq("id", businessId);
  return row(saved);
}

/** "Pagar mensalidade": the invoice link (Pix, boleto or card). */
export async function payFee(input: z.infer<typeof paySchema>) {
  if (isDemo()) {
    return mutateDemo((store) => {
      const access = store.access ?? { status: "active" as const, until: null };
      if (!billable(access)) throw new DomainError("Seu plano não tem mensalidade para pagar agora.", 409);
      const open = store.platformInvoices?.find((item) => item.status === "pending");
      if (open) return open;
      const invoice: PlatformInvoice = {
        id: `demo_fee_${randomUUID()}`,
        value: access.price!,
        dueDate: dueFor(access),
        status: "pending",
        invoiceUrl: "",
        paidAt: null,
        createdAt: new Date().toISOString(),
      };
      (store.platformInvoices ??= []).push(invoice);
      return invoice;
    }, await demoWorkspaceSlug());
  }
  const { businessId, role, user } = await requireMembership({ allowClosed: true });
  if (!payers.includes(role)) throw new DomainError("Peça para o dono pagar a mensalidade.", 403);
  if (!billingReady()) throw new DomainError("A cobrança online ainda está sendo ligada. Fale com o StudioFlow.", 503);
  return openInvoice(businessId, input.document, { email: user.email || undefined });
}

/** "Já paguei": asks Asaas, so the access opens even if the webhook is late. */
export async function checkFee() {
  if (isDemo()) {
    // Demonstração: confirmar = simular o pagamento.
    return mutateDemo((store) => {
      const open = store.platformInvoices?.find((item) => item.status === "pending");
      if (!open) return { paid: false };
      open.status = "paid";
      open.paidAt = new Date().toISOString();
      const access = store.access ?? { status: "active" as const, until: null };
      store.access = { ...access, status: "active", until: extendUntil(access.until, period) };
      store.accessEvents = [
        ...(store.accessEvents || []),
        { id: randomUUID(), action: "paid" as const, days: period, until: store.access.until, createdAt: open.paidAt },
      ].slice(-50);
      return { paid: true };
    }, await demoWorkspaceSlug());
  }
  const { businessId } = await requireMembership({ allowClosed: true });
  const { data: open } = await createSupabaseAdmin()
    .from("platform_invoices")
    .select("asaas_charge_id")
    .eq("business_id", businessId)
    .eq("status", "pending")
    .maybeSingle();
  if (!open || !billingReady()) return { paid: false };
  const payment = await platformAsaas().payment(open.asaas_charge_id as string);
  if (!paidStatuses.has(payment.status)) return { paid: false };
  await markPaid(open.asaas_charge_id as string);
  return { paid: true };
}

/** Webhook or check: marks the invoice and adds the days, once. */
export async function markPaid(chargeId: string) {
  const { error } = await createSupabaseAdmin().rpc("platform_invoice_paid", { p_charge_id: chargeId });
  if (error) throw new DomainError("Não foi possível liberar o acesso.", 503);
}

/* ------------------------------------------------------------------ */
/* Lembretes de vencimento                                              */
/* ------------------------------------------------------------------ */

export type ReminderStage = "soon" | "today" | "late";

/** Which reminder is due now: 3 days before, on the day, and once after. */
export function reminderStage(access: BusinessAccess, now = new Date()): ReminderStage | null {
  if (!billable(access) || !access.until || access.status !== "active") return null;
  const left = daysLeft(access, now)!;
  if (left <= 0) return left >= -7 ? "late" : null;
  if (left === 1) return "today";
  if (left === 3) return "soon";
  return null;
}

export function reminderText(input: {
  stage: ReminderStage;
  owner: string;
  business: string;
  plan: string;
  price: number;
  link: string;
}) {
  const first = input.owner.trim().split(/\s+/)[0] || "tudo bem";
  const fee = `${input.plan ? `plano ${input.plan}, ` : ""}${money(input.price)}`;
  const head =
    input.stage === "late"
      ? `Oi, ${first}! Aqui é o StudioFlow. 💈\n\nO acesso da *${input.business}* ficou pausado porque a mensalidade (${fee}) venceu.`
      : `Oi, ${first}! Aqui é o StudioFlow. 💈\n\nA mensalidade da *${input.business}* (${fee}) vence ${input.stage === "today" ? "*hoje*" : "em *3 dias*"}.`;
  return `${head}\n\nÉ só pagar pelo link, no Pix, boleto ou cartão, e o acesso ${
    input.stage === "late" ? "volta na hora" : "renova sozinho"
  }:\n${input.link}\n\nQualquer dúvida, é só responder aqui.`;
}
