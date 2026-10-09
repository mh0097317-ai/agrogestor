import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { assertProfessionalChannel } from "@/lib/professional-scope";
import {
  realWhatsAppContacts,
  type WhatsAppContact,
} from "@/lib/whatsapp-contacts";
import { createSupabaseAdmin, requireMembership } from "@/lib/supabase/server";
import { findContacts, instanceState } from "./evolution";
import { isDemo } from "../server-demo";
import { liveRepo } from "../assistant/conversations";
import { brazilPhone } from "../assistant/whatsapp";

export const contactSyncSchema = z.object({
  professionalId: z.string().uuid().optional(),
  page: z.number().int().min(1).max(500).default(1),
});
const roles = ["owner", "admin", "manager", "receptionist", "professional"];
async function channel(professionalId?: string) {
  if (isDemo())
    throw new DomainError(
      "Sincronize contatos reais no ambiente publicado.",
      409,
    );
  const member = await requireMembership();
  if (!roles.includes(member.role))
    throw new DomainError("Seu perfil não pode acessar o WhatsApp.", 403);
  assertProfessionalChannel(member, professionalId);
  const admin = createSupabaseAdmin();
  if (professionalId) {
    const { data: person, error } = await admin
      .from("professionals")
      .select("id")
      .eq("business_id", member.businessId)
      .eq("id", professionalId)
      .eq("active", true)
      .maybeSingle();
    if (error)
      throw new DomainError("Não foi possível verificar o profissional.", 503);
    if (!person) throw new DomainError("Profissional não encontrado.", 404);
  }
  let query = admin
    .from(professionalId ? "professional_whatsapp_links" : "whatsapp_links")
    .select("instance,status,phone")
    .eq("business_id", member.businessId);
  if (professionalId) query = query.eq("professional_id", professionalId);
  const { data: link, error } = await query.maybeSingle();
  if (error)
    throw new DomainError("Não foi possível consultar a conexão.", 503);
  return { member, admin, link };
}

export async function syncWhatsAppContacts(
  input: z.infer<typeof contactSyncSchema>,
) {
  const { member, admin, link } = await channel(input.professionalId);
  if (!link || (await instanceState(link.instance)) !== "open")
    throw new DomainError(
      "Conecte este WhatsApp antes de sincronizar seus contatos.",
      409,
    );
  const { data: business, error } = await admin
    .from("businesses")
    .select("tenant_id")
    .eq("id", member.businessId)
    .single();
  if (error || !business)
    throw new DomainError("Não foi possível consultar a barbearia.", 503);
  const rows = await findContacts(link.instance, input.page);
  const contacts = realWhatsAppContacts(rows, link.phone);
  if (contacts.length) {
    const { error: saveError } = await admin.from("whatsapp_contacts").upsert(
      contacts.map((c) => ({
        business_id: member.businessId,
        tenant_id: business.tenant_id,
        professional_id: input.professionalId || null,
        channel_key: input.professionalId || "shop",
        phone: c.phone,
        name: c.name,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: "business_id,channel_key,phone" },
    );
    if (saveError)
      throw new DomainError(
        "Não foi possível salvar os contatos deste número.",
        503,
      );
  }
  return {
    imported: contacts.length,
    skipped: rows.length - contacts.length,
    nextPage: rows.length === 500 ? input.page + 1 : null,
  };
}

export async function listWhatsAppContacts(input: {
  professionalId?: string;
  offset: number;
  search: string;
}) {
  const { member } = await channel(input.professionalId);
  const { data, error, count } = await member.client
    .from("whatsapp_contacts")
    .select("id,professional_id,name,phone,synced_at", { count: "exact" })
    .eq("business_id", member.businessId)
    .eq("channel_key", input.professionalId || "shop")
    .or(
      `name.ilike.%${input.search.replace(/[^\p{L}\p{N} +@'-]/gu, "")}%,phone.ilike.%${input.search.replace(/\D/g, "") || "NO_PHONE_MATCH"}%`,
    )
    .order("name")
    .order("id")
    .range(input.offset, input.offset + 99);
  if (error)
    throw new DomainError("Não foi possível carregar os contatos.", 503);
  return {
    total: count || 0,
    contacts: (data || []).map((r) => ({
      id: r.id,
      professionalId: r.professional_id,
      name: r.name,
      phone: r.phone,
      syncedAt: r.synced_at,
    })) as WhatsAppContact[],
  };
}

/** Opening a real contact never queues AI or imports their personal message history. */
export async function openWhatsAppContact(id: string) {
  const member = await requireMembership();
  if (!roles.includes(member.role))
    throw new DomainError("Seu perfil não pode acessar o WhatsApp.", 403);
  const { data: contact, error } = await member.client
    .from("whatsapp_contacts")
    .select("phone,name,professional_id")
    .eq("business_id", member.businessId)
    .eq("id", id)
    .maybeSingle();
  if (error)
    throw new DomainError("Não foi possível consultar o contato.", 503);
  if (!contact) throw new DomainError("Contato não encontrado.", 404);
  assertProfessionalChannel(member, contact.professional_id);
  const admin = createSupabaseAdmin();
  const { data: business } = await admin
    .from("businesses")
    .select("tenant_id")
    .eq("id", member.businessId)
    .single();
  if (!business) throw new DomainError("Barbearia não encontrada.", 404);
  const repo = liveRepo(member.businessId, business.tenant_id);
  const phone = brazilPhone(contact.phone);
  let conversation = await repo.byPhone(
    "whatsapp",
    phone,
    contact.professional_id || undefined,
  );
  if (!conversation) {
    try {
      conversation = await repo.create({
        channel: "whatsapp",
        contactPhone: phone,
        contactName: contact.name,
        professionalId: contact.professional_id || undefined,
        contactRef: `wa:${contact.phone}`,
      });
      await repo.update(conversation.id, { status: "human" });
    } catch (error) {
      conversation = await repo.byPhone(
        "whatsapp",
        phone,
        contact.professional_id || undefined,
      );
      if (!conversation) throw error;
    }
  }
  return { id: conversation.id };
}
