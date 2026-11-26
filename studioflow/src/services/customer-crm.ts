import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin, requireMembership } from "@/lib/supabase/server";
import { crmUpdateSchema } from "@/lib/crm";
import { isDemo, mutateDemo, readDemo } from "./server-demo";

const editors = ["owner", "admin", "manager", "receptionist"];
const exporters = ["owner", "admin", "manager"];
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Aniversário e consentimento. Cada mudança de consentimento vira evento. */
export async function updateCustomerCrm(customerId: string, input: unknown) {
  const change = crmUpdateSchema.parse(input);
  if (change.birthDate && (change.birthDate < "1900-01-01" || change.birthDate > today()))
    throw new DomainError("Data de nascimento inválida.");
  const now = new Date().toISOString();
  if (isDemo())
    return mutateDemo((store) => {
      if (store.viewer && !editors.includes(store.viewer.role))
        throw new DomainError("Sem permissão para editar clientes.", 403);
      const customer = store.customers.find((c) => c.id === customerId);
      if (!customer) throw new DomainError("Cliente não encontrado.", 404);
      if (change.birthDate !== undefined) customer.birthDate = change.birthDate;
      if (change.marketingConsent !== undefined && change.marketingConsent !== !!customer.marketingConsent) {
        customer.marketingConsent = change.marketingConsent;
        customer.consentUpdatedAt = now;
      }
      return customer;
    });
  const { businessId, role, user } = await requireMembership();
  if (!editors.includes(role)) throw new DomainError("Sem permissão para editar clientes.", 403);
  const admin = createSupabaseAdmin();
  const { data: current, error: readError } = await admin
    .from("customers")
    .select("id,marketing_consent")
    .eq("business_id", businessId)
    .eq("id", customerId)
    .maybeSingle();
  if (readError) throw new DomainError("Não foi possível salvar.", 503);
  if (!current) throw new DomainError("Cliente não encontrado.", 404);
  const consentChanged =
    change.marketingConsent !== undefined && change.marketingConsent !== current.marketing_consent;
  const patch: Record<string, unknown> = { updated_at: now };
  if (change.birthDate !== undefined) patch.birth_date = change.birthDate;
  if (consentChanged) {
    patch.marketing_consent = change.marketingConsent;
    patch.consent_updated_at = now;
  }
  const { error } = await admin
    .from("customers")
    .update(patch)
    .eq("business_id", businessId)
    .eq("id", customerId);
  if (error) throw new DomainError("Não foi possível salvar.", 503);
  if (consentChanged)
    await admin.from("customer_consent_events").insert({
      business_id: businessId,
      customer_id: customerId,
      consent: change.marketingConsent,
      source: change.consentSource || "painel",
      actor: user.id,
      note: change.note || null,
    });
  return { id: customerId, ...change };
}

/**
 * Exportação dos dados de um cliente (pedido do titular, LGPD art. 18).
 * Só gerência. Não inclui dados de outros clientes nem segredos da casa.
 */
export async function exportCustomerData(customerId: string) {
  if (isDemo()) {
    const store = await readDemo();
    if (store.viewer && !exporters.includes(store.viewer.role))
      throw new DomainError("Só a gerência exporta dados de clientes.", 403);
    const customer = store.customers.find((c) => c.id === customerId);
    if (!customer) throw new DomainError("Cliente não encontrado.", 404);
    const appointments = store.appointments.filter((a) => a.customerId === customerId);
    const ids = new Set(appointments.map((a) => a.id));
    return {
      generatedAt: new Date().toISOString(),
      business: store.business.name,
      customer,
      appointments,
      payments: store.payments.filter((p) => ids.has(p.appointmentId)),
      productSales: (store.productSales || []).filter((s) => s.customerId === customerId),
      reviews: (store.reviews || []).filter((r) => ids.has(r.appointmentId)),
      consentEvents: [],
      conversations: [],
    };
  }
  const { businessId, role } = await requireMembership();
  if (!exporters.includes(role))
    throw new DomainError("Só a gerência exporta dados de clientes.", 403);
  const admin = createSupabaseAdmin();
  const { data: business } = await admin.from("businesses").select("name").eq("id", businessId).maybeSingle();
  const { data: customer } = await admin
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) throw new DomainError("Cliente não encontrado.", 404);
  const { data: appointments } = await admin
    .from("appointments")
    .select("id,start,end,status,price,professional_id,booking_channel,created_at")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .order("start");
  const ids = (appointments || []).map((a) => a.id as string);
  const [payments, sales, reviews, consent, conversations] = await Promise.all([
    ids.length
      ? admin.from("payments").select("appointment_id,amount,method,created_at").eq("business_id", businessId).in("appointment_id", ids)
      : Promise.resolve({ data: [] }),
    admin.from("product_sales").select("items,total,method,status,created_at").eq("business_id", businessId).eq("customer_id", customerId),
    ids.length
      ? admin.from("reviews").select("rating,comment,created_at").eq("business_id", businessId).in("appointment_id", ids)
      : Promise.resolve({ data: [] }),
    admin.from("customer_consent_events").select("consent,source,note,created_at").eq("business_id", businessId).eq("customer_id", customerId).order("created_at"),
    admin.from("conversations").select("id,channel,created_at").eq("business_id", businessId).eq("contact_phone", customer.phone).limit(20),
  ]);
  const conversationIds = ((conversations.data || []) as { id: string }[]).map((c) => c.id);
  const messages = conversationIds.length
    ? (
        await admin
          .from("conversation_messages")
          .select("conversation_id,role,body,created_at")
          .eq("business_id", businessId)
          .in("conversation_id", conversationIds)
          .order("created_at")
          .limit(5000)
      ).data || []
    : [];
  return {
    generatedAt: new Date().toISOString(),
    business: business?.name,
    customer,
    appointments: appointments || [],
    payments: payments.data || [],
    productSales: sales.data || [],
    reviews: reviews.data || [],
    consentEvents: consent.data || [],
    conversations: ((conversations.data || []) as { id: string; channel: string; created_at: string }[]).map((c) => ({
      ...c,
      messages: (messages as { conversation_id: string }[]).filter((m) => m.conversation_id === c.id),
    })),
  };
}

/** "SAIR" no WhatsApp: tira o cliente do marketing. Lembretes de horário seguem. */
export const optOutPattern = /^\s*(sair|parar|stop|descadastrar)\s*[.!]*\s*$/i;
export async function optOutByPhone(businessId: string, phone: string) {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("customers")
    .update({ marketing_consent: false, consent_updated_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("phone", phone)
    .eq("marketing_consent", true)
    .select("id");
  for (const row of (data || []) as { id: string }[])
    await admin.from("customer_consent_events").insert({
      business_id: businessId,
      customer_id: row.id,
      consent: false,
      source: "whatsapp_sair",
    });
  return (data || []).length;
}
