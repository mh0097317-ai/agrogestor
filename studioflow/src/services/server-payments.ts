import { randomBytes, randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { DomainError, servicesFor } from "@/lib/availability";
import {
  applyMembership,
  confirmDeposit,
  coverageMessages,
  depositFor,
  expireHolds,
  holdDeposit,
  isValidCpf,
  membershipUsage,
  minimumCharge,
  monthKey,
  type CoverageResult,
} from "@/lib/payments";
import { createSupabaseAdmin, requireMembership } from "@/lib/supabase/server";
import type { Appointment, DemoCharge, Membership, Store } from "@/types";
import { AsaasClient, paidStatuses, type PixCode } from "./payments/asaas";
import { isDemo, mutateDemo, readDemo } from "./server-demo";
import { assertPublicOpen } from "@/lib/access";
import {
  decryptSecret,
  encryptSecret,
  matchesHash,
  newToken,
  sha256,
} from "./server-secrets";
import {
  businessDayKey,
  camel,
  createBooking,
  demoWorkspaceSlug,
  getPublicStore,
  readPaymentAccount,
} from "./server-store";
import type { bookSchema } from "./server-validation";

const id = z.string().uuid();
const editors = ["owner", "admin", "manager"];
const toBytea = (value: Buffer) => `\\x${value.toString("hex")}`;
const fromBytea = (value: string | null | undefined) =>
  value ? Buffer.from(value.replace(/^\\x/, ""), "hex") : null;
const cpfField = z
  .string()
  .max(20)
  .transform((value) => value.replace(/\D/g, ""))
  .refine(isValidCpf, "Informe um CPF válido.");

/* ------------------------------------------------------------------ */
/* Connection                                                          */
/* ------------------------------------------------------------------ */

export const connectSchema = z.object({
  environment: z.enum(["sandbox", "production"]),
  apiKey: z
    .string()
    .trim()
    .min(20, "Cole a chave de API completa do Asaas.")
    .max(400),
});
export const depositSchema = z
  .object({
    depositMode: z.enum(["off", "fixed", "percent"]),
    depositValue: z.number().min(0).max(100000),
    depositHold: z.number().int().min(5).max(120),
  })
  .refine(
    (value) => value.depositMode !== "percent" || value.depositValue <= 100,
    "O percentual vai até 100%.",
  )
  .refine(
    (value) =>
      value.depositMode === "off" ||
      (value.depositMode === "fixed" && value.depositValue >= minimumCharge) ||
      (value.depositMode === "percent" && value.depositValue >= 1),
    `O sinal mínimo é de R$ ${minimumCharge},00.`,
  );

export const getPaymentAccount = readPaymentAccount;

async function gatewayFor(businessId: string) {
  const { data } = await createSupabaseAdmin()
    .from("payment_accounts")
    .select("environment,api_key_enc")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data)
    throw new DomainError(
      "Este estabelecimento não está recebendo pagamentos online agora.",
      409,
    );
  return new AsaasClient(decryptSecret(data.api_key_enc), data.environment);
}

async function requireEditor() {
  const membership = await requireMembership();
  if (!editors.includes(membership.role))
    throw new DomainError(
      "Só o dono ou a gerência podem alterar os pagamentos.",
      403,
    );
  return membership;
}

export async function connectPayments(
  input: z.infer<typeof connectSchema>,
  origin: string,
) {
  if (isDemo())
    return mutateDemo(
      (store) => {
        store.paymentAccount = {
          provider: "asaas",
          environment: "demo",
          hint: "simulado",
          webhook: true,
          createdAt: new Date().toISOString(),
        };
        return { account: store.paymentAccount, warning: "" };
      },
      await demoWorkspaceSlug(),
    );
  const { businessId, user } = await requireEditor();
  const client = new AsaasClient(input.apiKey, input.environment);
  await client.check();
  const admin = createSupabaseAdmin();
  const { data: business } = await admin
    .from("businesses")
    .select("tenant_id")
    .eq("id", businessId)
    .single();
  // Replace a previous connection: its notifications stop.
  await removeWebhook(businessId);
  const webhookToken = randomBytes(36).toString("base64url");
  let webhookId: string | null = null;
  let warning = "";
  try {
    webhookId = await client.createWebhook({
      url: `${origin}/api/payments/asaas/${businessId}`,
      email: user.email || "",
      token: webhookToken,
    });
  } catch (error) {
    warning =
      error instanceof DomainError
        ? `Conta conectada, mas os avisos automáticos não foram ativados (${error.message}). Os pagamentos serão conferidos quando o cliente abrir o comprovante.`
        : "Conta conectada, mas os avisos automáticos não foram ativados.";
  }
  const { error } = await admin.from("payment_accounts").upsert({
    business_id: businessId,
    tenant_id: business!.tenant_id,
    provider: "asaas",
    environment: input.environment,
    api_key_enc: encryptSecret(input.apiKey),
    api_key_hint: input.apiKey.slice(-4),
    webhook_id: webhookId,
    webhook_token_hash: webhookId ? toBytea(sha256(webhookToken)) : null,
    connected_by: user.id,
  });
  if (error)
    throw new DomainError("Não foi possível salvar a conexão.", 503);
  return { account: await getPaymentAccount(businessId), warning };
}

async function removeWebhook(businessId: string) {
  const { data } = await createSupabaseAdmin()
    .from("payment_accounts")
    .select("environment,api_key_enc,webhook_id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data?.webhook_id) return;
  try {
    await new AsaasClient(
      decryptSecret(data.api_key_enc),
      data.environment,
    ).deleteWebhook(data.webhook_id);
  } catch {
    // The old key may be revoked already; nothing else to clean.
  }
}

export async function disconnectPayments() {
  if (isDemo())
    return mutateDemo(
      (store) => {
        store.paymentAccount = null;
        return { account: null };
      },
      await demoWorkspaceSlug(),
    );
  const { businessId } = await requireEditor();
  await removeWebhook(businessId);
  const { error } = await createSupabaseAdmin()
    .from("payment_accounts")
    .delete()
    .eq("business_id", businessId);
  if (error) throw new DomainError("Não foi possível desconectar.", 503);
  return { account: null };
}

export async function updateDeposit(input: z.infer<typeof depositSchema>) {
  if (isDemo())
    return mutateDemo(
      (store) => {
        Object.assign(store.settings, input);
        return input;
      },
      await demoWorkspaceSlug(),
    );
  const { client, businessId } = await requireEditor();
  // RLS (admin_update on business_settings) checks the role again.
  const { error } = await client
    .from("business_settings")
    .update({
      deposit_mode: input.depositMode,
      deposit_value: input.depositValue,
      deposit_hold: input.depositHold,
    })
    .eq("business_id", businessId);
  if (error) throw new DomainError("Não foi possível salvar o sinal.", 503);
  return input;
}

/* ------------------------------------------------------------------ */
/* Booking with deposit or club                                        */
/* ------------------------------------------------------------------ */

export interface BookingOutcome extends Appointment {
  /** Why the club did not cover this booking, when it was asked to. */
  membershipNotice?: string;
}

function chargeDueDate(holdMinutes: number) {
  // The Pix stays valid at least until the hold ends.
  return businessDayKey(0, new Date(Date.now() + holdMinutes * 60_000));
}

function depositDescription(store: Store, appointment: Appointment) {
  const names = servicesFor(store, appointment.serviceIds)
    .map((service) => service.name)
    .join(" + ");
  const when = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(appointment.start));
  return `Sinal · ${names} · ${when} · ${store.business.name}`;
}

const cpfRequired =
  "Informe um CPF válido para gerar o Pix do sinal. Ele vai só para o Asaas, que emite a cobrança.";

export async function bookWithPayments(
  slug: string,
  input: z.infer<typeof bookSchema>,
): Promise<BookingOutcome> {
  const cpf = input.cpf || "";
  if (isDemo())
    return mutateDemo((store) => {
      assertPublicOpen(store.access ?? { status: "active", until: null });
      expireHolds(store);
      const ready = !!store.paymentAccount;
      const price = servicesFor(store, input.serviceIds).reduce(
        (sum, service) => sum + service.price,
        0,
      );
      const planned = ready ? depositFor(store.settings, price) : 0;
      if (planned && !input.membershipToken && !isValidCpf(cpf))
        throw new DomainError(cpfRequired, 400);
      const appointment = createBooking(store, input) as BookingOutcome;
      let coverage: CoverageResult | undefined;
      if (input.membershipToken)
        coverage = applyMembership(
          store,
          appointment,
          store.memberships?.find(
            (item) => item.token === input.membershipToken,
          ),
        );
      if (coverage === "covered") return appointment;
      if (coverage) appointment.membershipNotice = coverageMessages[coverage];
      if (planned) {
        if (!isValidCpf(cpf)) {
          store.appointments.splice(store.appointments.indexOf(appointment), 1);
          throw new DomainError(
            `${appointment.membershipNotice || ""} ${cpfRequired}`.trim(),
            400,
          );
        }
        holdDeposit(appointment, planned, store.settings.depositHold);
        const charge: DemoCharge = {
          id: `demo_${randomUUID()}`,
          kind: "deposit",
          value: appointment.depositAmount!,
          status: "PENDING",
          reference: appointment.id,
          createdAt: new Date().toISOString(),
        };
        (store.demoCharges ??= []).push(charge);
        appointment.depositChargeId = charge.id;
      }
      return appointment;
    }, slug);

  const store = await getPublicStore(slug);
  const businessId = store.business.id;
  const account = await getPaymentAccount(businessId);
  const price = servicesFor(store, input.serviceIds).reduce(
    (sum, service) => sum + service.price,
    0,
  );
  const planned = account ? depositFor(store.settings, price) : 0;
  if (planned && !input.membershipToken && !isValidCpf(cpf))
    throw new DomainError(cpfRequired, 400);
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc("book_appointment", {
    p_business_id: businessId,
    p_service_ids: input.serviceIds,
    p_professional_id:
      input.professionalId === "any" ? null : input.professionalId,
    p_start: input.start,
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email || null,
    p_reminder: input.reminder,
  });
  if (error)
    throw new DomainError(
      error.message.includes("unavailable")
        ? "Este horário acabou de ficar indisponível. Escolha outro horário."
        : "Não foi possível confirmar. Confira os dados e tente novamente.",
      409,
    );
  const appointment = camel(data) as BookingOutcome;
  const cancel = () =>
    admin
      .from("appointments")
      .update({ status: "cancelled", deposit_status: null })
      .eq("id", appointment.id);
  if (input.membershipToken) {
    const { data: result } = await admin.rpc("apply_membership", {
      p_appointment_id: appointment.id,
      p_token: input.membershipToken,
    });
    if (result === "covered") {
      appointment.price = 0;
      return appointment;
    }
    appointment.membershipNotice =
      coverageMessages[(result || "invalid") as Exclude<CoverageResult, "covered">];
  }
  if (!planned) return appointment;
  if (!isValidCpf(cpf)) {
    await cancel();
    throw new DomainError(
      `${appointment.membershipNotice || ""} ${cpfRequired}`.trim(),
      400,
    );
  }
  const hold = await admin.rpc("hold_for_deposit", {
    p_appointment_id: appointment.id,
    p_amount: planned,
    p_minutes: store.settings.depositHold,
  });
  if (hold.error) {
    await cancel();
    throw new DomainError("Não foi possível reservar o horário.", 409);
  }
  try {
    const gateway = await gatewayFor(businessId);
    const customer = await gateway.findOrCreateCustomer({
      name: input.name,
      cpf,
      phone: input.phone,
      email: input.email || undefined,
      reference: `customer:${appointment.customerId}`,
    });
    const charge = await gateway.createPixCharge({
      customer,
      value: Math.min(planned, price),
      dueDate: chargeDueDate(store.settings.depositHold),
      description: depositDescription(store, appointment),
      reference: `appointment:${appointment.id}`,
    });
    const saved = await admin
      .from("appointments")
      .update({ deposit_charge_id: charge.id })
      .eq("id", appointment.id)
      .select("status,deposit_amount,deposit_status,deposit_expires_at")
      .single();
    if (saved.error) throw new Error("save");
    Object.assign(appointment, camel(saved.data), {
      depositChargeId: charge.id,
    });
    return appointment;
  } catch (cause) {
    await cancel();
    throw new DomainError(
      cause instanceof DomainError && cause.status !== 409
        ? `${cause.message} Seu horário não foi reservado; tente de novo.`
        : "Não foi possível gerar o Pix agora. Seu horário não foi reservado; tente de novo.",
      502,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Deposit status on the receipt                                       */
/* ------------------------------------------------------------------ */

export interface DepositView {
  status: "pending" | "paid" | "expired" | "none";
  amount: number;
  expiresAt: string | null;
  pix?: PixCode;
  /** Demo: a button simulates the payment. */
  simulated?: boolean;
}

async function demoPix(charge: DemoCharge): Promise<PixCode> {
  const payload = `STUDIOFLOW-DEMONSTRACAO|PIX-SIMULADO|${charge.id}|${charge.value.toFixed(2)}`;
  const url = await QRCode.toDataURL(payload, { margin: 1, width: 360 });
  return { image: url.replace(/^data:image\/png;base64,/, ""), payload };
}

const viewOf = (appointment: Appointment): DepositView => ({
  status:
    appointment.depositStatus === "paid"
      ? "paid"
      : appointment.depositStatus === "expired" ||
          (appointment.depositStatus === "pending" &&
            appointment.status === "cancelled")
        ? "expired"
        : appointment.depositStatus === "pending"
          ? "pending"
          : "none",
  amount: Number(appointment.depositAmount || 0),
  expiresAt: appointment.depositExpiresAt || null,
});

export async function depositStatus(
  token: string,
  options: { pix: boolean; check: boolean },
): Promise<DepositView> {
  if (isDemo()) {
    const { findDemoToken } = await import("./server-demo");
    const { slug } = await findDemoToken(token);
    return mutateDemo(async (store) => {
      expireHolds(store);
      const appointment = store.appointments.find(
        (item) => item.token === token,
      )!;
      const view = viewOf(appointment);
      const charge = store.demoCharges?.find(
        (item) => item.id === appointment.depositChargeId,
      );
      if (view.status === "pending" && charge && options.pix)
        view.pix = await demoPix(charge);
      return { ...view, simulated: view.status === "pending" };
    }, slug);
  }
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc("get_booking", { p_token: token });
  if (error || !data) throw new DomainError("Agendamento não encontrado.", 404);
  let appointment = camel(
    (data as { appointment: unknown }).appointment,
  ) as Appointment;
  const businessId = appointment.businessId;
  const chargeId = appointment.depositChargeId;
  const reload = async () => {
    const fresh = await admin
      .from("appointments")
      .select(
        "status,deposit_amount,deposit_status,deposit_expires_at,deposit_charge_id",
      )
      .eq("id", appointment.id)
      .single();
    if (fresh.data)
      appointment = { ...appointment, ...(camel(fresh.data) as object) };
  };
  if (appointment.depositStatus !== "pending" || !chargeId)
    return viewOf(appointment);
  const gateway = await gatewayFor(businessId);
  if (options.check || appointment.status === "cancelled") {
    // Webhook missed or late: ask the provider.
    const payment = await gateway.payment(chargeId).catch(() => null);
    if (payment && paidStatuses.has(payment.status)) {
      await admin.rpc("confirm_deposit", {
        p_business_id: businessId,
        p_charge_id: chargeId,
      });
      await reload();
      return viewOf(appointment);
    }
  }
  if (
    appointment.depositExpiresAt &&
    new Date(appointment.depositExpiresAt).getTime() < Date.now()
  ) {
    await admin.rpc("expire_deposit_holds", { p_business_id: businessId });
    // A late Pix would arrive for a released slot: remove the charge.
    await gateway.deletePayment(chargeId).catch(() => undefined);
    await reload();
    return viewOf(appointment);
  }
  const view = viewOf(appointment);
  if (options.pix && view.status === "pending")
    view.pix = await gateway.pixCode(chargeId);
  return view;
}

/** Demo only: pays a simulated charge as if the provider had confirmed it. */
export async function simulateDemoCharge(chargeId: string) {
  if (!isDemo()) throw new DomainError("Não encontrado.", 404);
  const { readdir } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const files = await readdir(join(process.cwd(), ".data")).catch(() => []);
  for (const file of files.filter((name) =>
    /^business-[a-z0-9-]+\.json$/.test(name),
  )) {
    const slug = file.slice(9, -5);
    const store = await readDemo(slug);
    if (!store.demoCharges?.some((charge) => charge.id === chargeId)) continue;
    return mutateDemo((current) => {
      const charge = current.demoCharges!.find((item) => item.id === chargeId)!;
      charge.status = "RECEIVED";
      if (charge.kind === "deposit")
        return { outcome: confirmDeposit(current, chargeId, randomUUID()) };
      const member = current.memberships?.find(
        (item) => item.id === charge.reference,
      );
      if (member && member.status !== "cancelled") {
        member.status = "active";
        member.nextDueDate = nextMonth(businessDayKey());
        member.invoiceUrl = null;
      }
      return { outcome: "active" };
    }, slug);
  }
  throw new DomainError("Cobrança não encontrada.", 404);
}

function nextMonth(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, Math.min(date, 28)));
  return next.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Webhook                                                             */
/* ------------------------------------------------------------------ */

const webhookSchema = z.object({
  event: z.string(),
  payment: z
    .object({
      id: z.string(),
      status: z.string().optional(),
      dueDate: z.string().optional(),
      invoiceUrl: z.string().optional().nullable(),
      subscription: z.string().optional().nullable(),
    })
    .passthrough()
    .optional(),
});

/**
 * Asaas notification for one business. Authenticated by the token set
 * at connection time (header `asaas-access-token`). Idempotent: Asaas
 * delivers at least once.
 */
export async function handleAsaasWebhook(
  businessId: string,
  token: string | null,
  body: unknown,
) {
  id.parse(businessId);
  const admin = createSupabaseAdmin();
  const { data: account } = await admin
    .from("payment_accounts")
    .select("webhook_token_hash")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!account || !matchesHash(token, fromBytea(account.webhook_token_hash)))
    throw new DomainError("Não autorizado.", 401);
  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success || !parsed.data.payment) return { ignored: true };
  const { event, payment } = parsed.data;
  const paid =
    event === "PAYMENT_RECEIVED" ||
    event === "PAYMENT_CONFIRMED" ||
    paidStatuses.has(payment.status || "");
  if (payment.subscription) {
    const { data: member } = await admin
      .from("memberships")
      .select("id,status")
      .eq("business_id", businessId)
      .eq("provider_subscription_id", payment.subscription)
      .maybeSingle();
    if (!member || member.status === "cancelled") return { ignored: true };
    const update: Record<string, unknown> = {};
    if (paid) {
      update.status = "active";
      update.invoice_url = null;
      if (payment.dueDate) update.next_due_date = nextMonth(payment.dueDate);
    } else if (event === "PAYMENT_CREATED") {
      if (payment.invoiceUrl) update.invoice_url = payment.invoiceUrl;
      if (payment.dueDate) update.next_due_date = payment.dueDate;
    } else if (event === "PAYMENT_OVERDUE" && member.status === "active") {
      update.status = "overdue";
      if (payment.invoiceUrl) update.invoice_url = payment.invoiceUrl;
    }
    if (Object.keys(update).length) {
      const { error } = await admin
        .from("memberships")
        .update(update)
        .eq("id", member.id);
      if (error) throw new Error("membership update failed");
    }
    return { handled: true };
  }
  if (paid) {
    const { error } = await admin.rpc("confirm_deposit", {
      p_business_id: businessId,
      p_charge_id: payment.id,
    });
    if (error) throw new Error("deposit confirmation failed");
    return { handled: true };
  }
  return { ignored: true };
}

/* ------------------------------------------------------------------ */
/* Club                                                                */
/* ------------------------------------------------------------------ */

export const planSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(2, "Dê um nome ao plano.").max(60),
  description: z.string().trim().max(240).default(""),
  price: z
    .number()
    .min(minimumCharge, `O plano custa pelo menos R$ ${minimumCharge},00.`)
    .max(100000),
  serviceIds: z
    .array(id)
    .min(1, "Escolha pelo menos um serviço incluso.")
    .max(30),
  monthlyLimit: z.number().int().min(1).max(31).nullable(),
});
export const subscribeSchema = z.object({
  planId: id,
  name: z.string().trim().min(3, "Informe seu nome completo.").max(100),
  phone: z
    .string()
    .max(25)
    .transform((value) => value.replace(/\D/g, ""))
    .refine(
      (value) => /^[1-9][0-9](9[0-9]{8}|[2-5][0-9]{7})$/.test(value),
      "Informe um WhatsApp válido com DDD.",
    ),
  cpf: cpfField,
  email: z.union([z.string().email("E-mail inválido."), z.literal("")]).optional(),
});

/** Public projection of the active plans. */
export function publicPlans(store: Store) {
  return (store.plans || [])
    .filter((plan) => plan.active)
    .map(({ id, name, description, price, serviceIds, monthlyLimit }) => ({
      id,
      name,
      description,
      price: Number(price),
      serviceIds,
      monthlyLimit,
    }));
}

export async function savePlan(input: z.infer<typeof planSchema>) {
  if (isDemo())
    return mutateDemo(
      (store) => {
        checkServices(store, input.serviceIds);
        store.plans ??= [];
        const existing = input.id
          ? store.plans.find((plan) => plan.id === input.id)
          : undefined;
        if (input.id && !existing)
          throw new DomainError("Plano não encontrado.", 404);
        if (existing) Object.assign(existing, input);
        else
          store.plans.push({
            ...input,
            id: randomUUID(),
            businessId: store.business.id,
            active: true,
            createdAt: new Date().toISOString(),
          });
        return store.plans;
      },
      await demoWorkspaceSlug(),
    );
  const { client, businessId } = await requireEditor();
  const { data: services } = await client
    .from("services")
    .select("id")
    .eq("business_id", businessId)
    .in("id", input.serviceIds);
  if ((services || []).length !== new Set(input.serviceIds).size)
    throw new DomainError("Serviço inválido.");
  const admin = createSupabaseAdmin();
  const row = {
    name: input.name,
    description: input.description,
    price: input.price,
    service_ids: input.serviceIds,
    monthly_limit: input.monthlyLimit,
  };
  if (input.id) {
    const { data, error } = await admin
      .from("membership_plans")
      .update(row)
      .eq("business_id", businessId)
      .eq("id", input.id)
      .select("id");
    if (error) throw new DomainError("Não foi possível salvar o plano.", 503);
    if (!data?.length) throw new DomainError("Plano não encontrado.", 404);
  } else {
    const { data: business } = await admin
      .from("businesses")
      .select("tenant_id")
      .eq("id", businessId)
      .single();
    const { error } = await admin.from("membership_plans").insert({
      ...row,
      tenant_id: business!.tenant_id,
      business_id: businessId,
    });
    if (error) throw new DomainError("Não foi possível criar o plano.", 503);
  }
  return { ok: true };
}

function checkServices(store: Store, serviceIds: string[]) {
  if (
    serviceIds.some(
      (serviceId) =>
        !store.services.some((service) => service.id === serviceId),
    )
  )
    throw new DomainError("Serviço inválido.");
}

/** Plans are archived, never deleted: subscribers keep their history. */
export async function setPlanActive(planId: string, active: boolean) {
  if (isDemo())
    return mutateDemo(
      (store) => {
        const plan = store.plans?.find((item) => item.id === planId);
        if (!plan) throw new DomainError("Plano não encontrado.", 404);
        plan.active = active;
        return { ok: true };
      },
      await demoWorkspaceSlug(),
    );
  const { businessId } = await requireEditor();
  const { data, error } = await createSupabaseAdmin()
    .from("membership_plans")
    .update({ active })
    .eq("business_id", businessId)
    .eq("id", planId)
    .select("id");
  if (error) throw new DomainError("Não foi possível alterar o plano.", 503);
  if (!data?.length) throw new DomainError("Plano não encontrado.", 404);
  return { ok: true };
}

export interface MembershipView {
  status: Membership["status"];
  customerName: string;
  customerPhone: string;
  price: number;
  invoiceUrl: string | null;
  nextDueDate: string | null;
  plan: ReturnType<typeof publicPlans>[number] | null;
  /** Club visits per month (yyyy-MM) still holding a slot. */
  usage: Record<string, number>;
  /** Demo: id of the simulated charge to pay. */
  simulatedCharge?: string;
}

function usageByMonth(appointments: Appointment[], membershipId: string) {
  const usage: Record<string, number> = {};
  const now = monthKey(new Date());
  for (const item of appointments)
    if (item.membershipId === membershipId) {
      const month = monthKey(item.start);
      if (month >= now && !usage[month])
        usage[month] = membershipUsage(
          appointments,
          membershipId,
          item.start,
        );
    }
  return usage;
}

export async function subscribe(
  slug: string,
  input: z.infer<typeof subscribeSchema>,
) {
  const token = newToken();
  if (isDemo())
    return mutateDemo((store) => {
      if (!store.paymentAccount)
        throw new DomainError("O clube ainda não está aberto.", 409);
      const plan = store.plans?.find(
        (item) => item.id === input.planId && item.active,
      );
      if (!plan) throw new DomainError("Plano indisponível.", 404);
      store.memberships ??= [];
      if (
        store.memberships.some(
          (item) =>
            item.customerPhone === input.phone && item.status !== "cancelled",
        )
      )
        throw new DomainError(alreadyMember, 409);
      let customer = store.customers.find(
        (person) => person.phone === input.phone,
      );
      if (!customer) {
        customer = {
          id: randomUUID(),
          businessId: store.business.id,
          name: input.name,
          phone: input.phone,
          email: input.email || undefined,
          visits: 0,
          totalSpent: 0,
          createdAt: new Date().toISOString(),
        };
        store.customers.push(customer);
      }
      const member: Membership = {
        id: randomUUID(),
        businessId: store.business.id,
        planId: plan.id,
        customerId: customer.id,
        customerName: input.name,
        customerPhone: input.phone,
        price: plan.price,
        status: "pending",
        providerSubscriptionId: `demo_sub_${randomUUID()}`,
        invoiceUrl: null,
        nextDueDate: businessDayKey(),
        createdAt: new Date().toISOString(),
        token,
      };
      store.memberships.push(member);
      (store.demoCharges ??= []).push({
        id: `demo_${randomUUID()}`,
        kind: "membership",
        value: plan.price,
        status: "PENDING",
        reference: member.id,
        createdAt: new Date().toISOString(),
      });
      return { token, invoiceUrl: null };
    }, slug);

  const store = await getPublicStore(slug);
  const businessId = store.business.id;
  const plan = store.plans?.find(
    (item) => item.id === input.planId && item.active,
  );
  if (!plan) throw new DomainError("Plano indisponível.", 404);
  const gateway = await gatewayFor(businessId);
  const admin = createSupabaseAdmin();
  const { data: existing } = await admin
    .from("memberships")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_phone", input.phone)
    .neq("status", "cancelled")
    .limit(1);
  if (existing?.length) throw new DomainError(alreadyMember, 409);
  const { data: customer, error: customerError } = await admin
    .from("customers")
    .upsert(
      {
        tenant_id: store.business.tenantId,
        business_id: businessId,
        name: input.name,
        phone: input.phone,
        email: input.email || null,
      },
      { onConflict: "business_id,phone", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (customerError || !customer)
    throw new DomainError("Não foi possível iniciar a assinatura.", 503);
  const { data: member, error } = await admin
    .from("memberships")
    .insert({
      tenant_id: store.business.tenantId,
      business_id: businessId,
      plan_id: plan.id,
      customer_id: customer.id,
      customer_name: input.name,
      customer_phone: input.phone,
      price: plan.price,
      token_hash: toBytea(sha256(token)),
    })
    .select("id")
    .single();
  if (error || !member)
    throw new DomainError("Não foi possível iniciar a assinatura.", 503);
  try {
    const providerCustomer = await gateway.findOrCreateCustomer({
      name: input.name,
      cpf: input.cpf,
      phone: input.phone,
      email: input.email || undefined,
      reference: `customer:${customer.id}`,
    });
    const subscription = await gateway.createSubscription({
      customer: providerCustomer,
      value: Number(plan.price),
      nextDueDate: businessDayKey(),
      description: `${plan.name} · ${store.business.name}`,
      reference: `membership:${member.id}`,
    });
    const first = (await gateway.subscriptionPayments(subscription.id))[0];
    await admin
      .from("memberships")
      .update({
        provider_customer_id: providerCustomer,
        provider_subscription_id: subscription.id,
        invoice_url: first?.invoiceUrl || null,
        next_due_date: subscription.nextDueDate,
      })
      .eq("id", member.id);
    return { token, invoiceUrl: first?.invoiceUrl || null };
  } catch (cause) {
    await admin.from("memberships").delete().eq("id", member.id);
    throw cause instanceof DomainError
      ? cause
      : new DomainError("Não foi possível criar a assinatura agora.", 502);
  }
}

const alreadyMember =
  "Este WhatsApp já tem uma assinatura aqui. Peça ao estabelecimento para reenviar seu acesso.";

export async function membershipStatus(
  slug: string,
  token: string,
  check: boolean,
): Promise<MembershipView> {
  if (isDemo()) {
    const store = await readDemo(slug);
    const member = store.memberships?.find((item) => item.token === token);
    if (!member) throw new DomainError("Assinatura não encontrada.", 404);
    return {
      ...memberView(store, member),
      simulatedCharge:
        member.status === "pending"
          ? store.demoCharges?.find(
              (charge) =>
                charge.reference === member.id && charge.status === "PENDING",
            )?.id
          : undefined,
    };
  }
  const store = await getPublicStore(slug);
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("memberships")
    .select("*")
    .eq("business_id", store.business.id)
    .eq("token_hash", toBytea(sha256(token)))
    .maybeSingle();
  if (!data) throw new DomainError("Assinatura não encontrada.", 404);
  let member = camel(data) as Membership;
  if (
    check &&
    member.providerSubscriptionId &&
    (member.status === "pending" || member.status === "overdue")
  ) {
    // Webhook missed: the provider is the source of truth for payments.
    const gateway = await gatewayFor(store.business.id);
    const payments = await gateway
      .subscriptionPayments(member.providerSubscriptionId)
      .catch(() => []);
    const paid = payments
      .filter((payment) => paidStatuses.has(payment.status))
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
    if (paid && nextMonth(paid.dueDate) >= businessDayKey()) {
      const { data: fresh } = await admin
        .from("memberships")
        .update({
          status: "active",
          invoice_url: null,
          next_due_date: nextMonth(paid.dueDate),
        })
        .eq("id", member.id)
        .neq("status", "cancelled")
        .select("*")
        .maybeSingle();
      if (fresh) member = camel(fresh) as Membership;
    }
  }
  return memberView(store, member);
}

function memberView(store: Store, member: Membership): MembershipView {
  const plan = publicPlans({
    ...store,
    plans: (store.plans || []).map((item) =>
      item.id === member.planId ? { ...item, active: true } : item,
    ),
  }).find((item) => item.id === member.planId);
  return {
    status: member.status,
    customerName: member.customerName,
    customerPhone: member.customerPhone,
    price: Number(member.price),
    invoiceUrl: member.invoiceUrl || null,
    nextDueDate: member.nextDueDate || null,
    plan: plan || null,
    usage: usageByMonth(store.appointments, member.id),
  };
}

export const membershipActionSchema = z.object({
  id,
  action: z.enum(["cancel", "access"]),
});

/**
 * Owner actions on a subscriber: cancel (stops the provider subscription)
 * or a new access link (rotates the device token, the old one stops).
 */
export async function changeMembership(
  input: z.infer<typeof membershipActionSchema>,
) {
  if (isDemo())
    return mutateDemo(
      (store) => {
        const member = store.memberships?.find((item) => item.id === input.id);
        if (!member) throw new DomainError("Assinatura não encontrada.", 404);
        if (input.action === "cancel") {
          member.status = "cancelled";
          return { ok: true };
        }
        member.token = newToken();
        return { ok: true, token: member.token };
      },
      await demoWorkspaceSlug(),
    );
  const { businessId } = await requireEditor();
  const admin = createSupabaseAdmin();
  const { data: member } = await admin
    .from("memberships")
    .select("id,status,provider_subscription_id")
    .eq("business_id", businessId)
    .eq("id", input.id)
    .maybeSingle();
  if (!member) throw new DomainError("Assinatura não encontrada.", 404);
  if (input.action === "cancel") {
    if (member.status === "cancelled") return { ok: true };
    if (member.provider_subscription_id) {
      const gateway = await gatewayFor(businessId);
      await gateway.cancelSubscription(member.provider_subscription_id);
    }
    const { error } = await admin
      .from("memberships")
      .update({ status: "cancelled", invoice_url: null })
      .eq("id", member.id);
    if (error) throw new DomainError("Não foi possível cancelar.", 503);
    return { ok: true };
  }
  const token = newToken();
  const { error } = await admin
    .from("memberships")
    .update({ token_hash: toBytea(sha256(token)) })
    .eq("id", member.id);
  if (error) throw new DomainError("Não foi possível gerar o acesso.", 503);
  return { ok: true, token };
}

/** A booking cancelled while its Pix was open: remove the charge. */
export async function dropPendingCharge(appointment: Appointment) {
  if (
    isDemo() ||
    appointment.depositStatus !== "pending" ||
    !appointment.depositChargeId
  )
    return;
  try {
    const gateway = await gatewayFor(appointment.businessId);
    await gateway.deletePayment(appointment.depositChargeId);
  } catch {
    // Paid meanwhile or already gone: confirm_deposit handles a late payment.
  }
}
