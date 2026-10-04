import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError, normalizePhone } from "@/lib/availability";
import { createSupabaseAdmin, requireMembership } from "@/lib/supabase/server";
import type { WaitlistEntry } from "@/types";
import { isDemo, mutateDemo } from "./server-demo";
import { businessDayKey, demoWorkspaceSlug } from "./server-store";

const id = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export const loyaltySchema = z.object({
  loyaltyEnabled: z.boolean(),
  loyaltyGoal: z.number().int().min(2, "Use pelo menos 2.").max(50),
  loyaltyReward: z.string().trim().max(80, "Use no máximo 80 caracteres."),
});
export const waitlistJoinSchema = z.object({
  serviceId: id,
  professionalId: z.union([id, z.literal("any")]).default("any"),
  date: day,
  period: z.enum(["any", "morning", "afternoon", "evening"]).default("any"),
  name: z.string().trim().min(2, "Informe seu nome.").max(100),
  phone: z
    .string()
    .max(25)
    .transform((value) => normalizePhone(value)),
});
export const waitlistUpdateSchema = z.object({
  id,
  status: z.enum(["waiting", "notified"]),
});
export const waitlistRemoveSchema = z.object({ id });

const editors = ["owner", "admin", "manager"];
const staff = [...editors, "receptionist"];

export async function updateLoyalty(input: z.infer<typeof loyaltySchema>) {
  if (input.loyaltyEnabled && !input.loyaltyReward)
    throw new DomainError("Diga qual é o prêmio do cartão fidelidade.", 400);
  if (isDemo())
    return mutateDemo(
      (store) => {
        Object.assign(store.settings, input);
        return store.settings;
      },
      await demoWorkspaceSlug(),
    );
  const { client, businessId, role } = await requireMembership();
  if (!editors.includes(role))
    throw new DomainError("Seu perfil não pode alterar a fidelidade.", 403);
  // RLS (admin_update on business_settings) checks the role again.
  const { error } = await client
    .from("business_settings")
    .update({
      loyalty_enabled: input.loyaltyEnabled,
      loyalty_goal: input.loyaltyGoal,
      loyalty_reward: input.loyaltyReward,
    })
    .eq("business_id", businessId);
  if (error)
    throw new DomainError("Não foi possível salvar a fidelidade.", 503);
  return input;
}

function checkDate(date: string, maxDays: number) {
  if (date < businessDayKey() || date > businessDayKey(maxDays))
    throw new DomainError("Escolha uma data dentro da agenda aberta.", 400);
}

/** A customer asks to be told when a full day frees up. */
export async function joinWaitlist(
  slug: string,
  input: z.infer<typeof waitlistJoinSchema>,
) {
  const professionalId =
    input.professionalId === "any" ? null : input.professionalId;
  if (isDemo())
    return mutateDemo((store) => {
      const service = store.services.find(
        (item) => item.id === input.serviceId && item.active,
      );
      if (!service) throw new DomainError("Serviço indisponível.", 404);
      if (
        professionalId &&
        !store.professionals.some(
          (person) => person.id === professionalId && person.active,
        )
      )
        throw new DomainError("Profissional indisponível.", 404);
      checkDate(input.date, store.settings.maxDays);
      store.waitlist ??= [];
      const existing = store.waitlist.find(
        (entry) =>
          entry.desiredDate === input.date &&
          entry.customerPhone === input.phone &&
          entry.serviceId === input.serviceId,
      );
      if (existing) return { joined: true, already: true };
      const entry: WaitlistEntry = {
        id: randomUUID(),
        businessId: store.business.id,
        serviceId: input.serviceId,
        professionalId,
        desiredDate: input.date,
        period: input.period,
        customerName: input.name,
        customerPhone: input.phone,
        status: "waiting",
        createdAt: new Date().toISOString(),
      };
      store.waitlist.push(entry);
      return { joined: true, already: false };
    }, slug);

  const admin = createSupabaseAdmin();
  const { data: business } = await admin
    .from("businesses")
    .select("id,tenant_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!business) throw new DomainError("Estabelecimento não encontrado.", 404);
  const [service, settings, person] = await Promise.all([
    admin
      .from("services")
      .select("id")
      .eq("business_id", business.id)
      .eq("id", input.serviceId)
      .eq("active", true)
      .maybeSingle(),
    admin
      .from("business_settings")
      .select("max_days")
      .eq("business_id", business.id)
      .maybeSingle(),
    professionalId
      ? admin
          .from("professionals")
          .select("id")
          .eq("business_id", business.id)
          .eq("id", professionalId)
          .eq("active", true)
          .maybeSingle()
      : Promise.resolve({ data: { id: null } }),
  ]);
  if (!service.data) throw new DomainError("Serviço indisponível.", 404);
  if (!person.data) throw new DomainError("Profissional indisponível.", 404);
  checkDate(input.date, settings.data?.max_days ?? 60);
  const { error } = await admin.from("waitlist").insert({
    tenant_id: business.tenant_id,
    business_id: business.id,
    service_id: input.serviceId,
    professional_id: professionalId,
    desired_date: input.date,
    period: input.period,
    customer_name: input.name,
    customer_phone: input.phone,
  });
  if (error?.code === "23505") return { joined: true, already: true };
  if (error)
    throw new DomainError(
      "Não foi possível entrar na lista de espera. Tente de novo.",
      503,
    );
  return { joined: true, already: false };
}

export async function changeWaitlist(
  action: "update" | "remove",
  input: { id: string; status?: "waiting" | "notified" },
) {
  if (isDemo())
    return mutateDemo(
      (store) => {
        const list = store.waitlist ?? [];
        const entry = list.find((item) => item.id === input.id);
        if (!entry) throw new DomainError("Pedido não encontrado.", 404);
        if (action === "remove")
          store.waitlist = list.filter((item) => item.id !== input.id);
        else entry.status = input.status!;
        return { ok: true };
      },
      await demoWorkspaceSlug(),
    );
  const { client, businessId, role } = await requireMembership();
  if (!staff.includes(role))
    throw new DomainError(
      "Seu perfil não pode alterar a lista de espera.",
      403,
    );
  // RLS limits both statements to this business and to staff roles.
  const query =
    action === "remove"
      ? client.from("waitlist").delete()
      : client.from("waitlist").update({ status: input.status });
  const { error, data } = await query
    .eq("business_id", businessId)
    .eq("id", input.id)
    .select("id");
  if (error)
    throw new DomainError("Não foi possível atualizar a lista de espera.", 503);
  if (!data?.length) throw new DomainError("Pedido não encontrado.", 404);
  return { ok: true };
}
