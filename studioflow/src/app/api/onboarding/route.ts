import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { onboardingSchema } from "@/services/server-validation";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
import { isDemo, createDemoBusiness } from "@/services/server-demo";
import {
  createSupabaseAdmin,
  createSupabaseServer,
} from "@/lib/supabase/server";
import { DomainError } from "@/lib/availability";
import type { Store } from "@/types";
import type { z } from "zod";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = onboardingSchema.parse(await request.json());
    const slug = `${input.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)}-${randomUUID().slice(0, 6)}`;
    if (isDemo()) {
      const businessId = randomUUID(),
        tenantId = randomUUID();
      const member = (name: string) => input.team.find((person) => person.name === name);
      const professionals: Store["professionals"] = input.professionalNames.map(
        (name) => ({
          id: randomUUID(),
          businessId,
          name,
          photo: member(name)?.photo || "",
          phone: member(name)?.phone || "",
          specialties: [],
          commission: 0,
          active: true,
          days: input.openDays,
          start: input.openStart,
          end: input.openEnd,
          breakStart: "",
          breakEnd: "",
        }),
      );
      const store: Store = {
        business: {
          id: businessId,
          tenantId,
          slug,
          name: input.name,
          category: input.category,
          description: input.description,
          address: input.address,
          phone: input.phone || "",
          instagram: input.instagram,
          cover: input.cover,
          logo: input.logo,
          color: input.color,
          photos: input.photos,
          amenities: input.amenities,
        },
        services: input.services.map((service) => ({
          ...service,
          id: randomUUID(),
          businessId,
          category: input.category,
          active: true,
          professionalIds: professionals.map((person) => person.id),
        })),
        professionals,
        customers: [],
        appointments: [],
        blockedTimes: [],
        payments: [],
        settings: {
          onlineBookingEnabled: true,
          businessId,
          minNotice: 30,
          maxDays: 60,
          buffer: 0,
          cancellationHours: 2,
          openDays: input.openDays,
          openStart: input.openStart,
          openEnd: input.openEnd,
          notifications: true,
          loyaltyEnabled: false,
          loyaltyGoal: 10,
          loyaltyReward: "",
          depositMode: "off",
          depositValue: 0,
          depositHold: 15,
          assistantEnabled: false,
          assistantName: "Recepção",
          assistantInstructions: "",
          assistantDailyLimit: 300,
        },
      };
      await createDemoBusiness(store);
      (await cookies()).set("studioflow-demo-business", slug, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 60 * 60 * 24 * 30,
      });
      return respond({ slug }, 201);
    }
    const auth = await createSupabaseServer(),
      {
        data: { user },
      } = await auth.auth.getUser();
    if (!user)
      throw new DomainError(
        "Entre na sua conta para criar seu estabelecimento.",
        401,
      );
    const admin = createSupabaseAdmin();
    // One account owns one business for now; repeating the setup would
    // silently create a second, disconnected one.
    const { data: existing } = await admin
      .from("business_members")
      .select("business_id")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1);
    if (existing?.length)
      throw new DomainError(
        "Sua conta já tem um estabelecimento. Abra o painel para continuar.",
        409,
      );
    const { data, error } = await admin.rpc("create_workspace", {
      p_user_id: user.id,
      p_slug: slug,
      p_input: input,
    });
    if (error)
      throw new DomainError(
        "Não foi possível criar seu estabelecimento. Tente novamente.",
        409,
      );
    const { data: business } = await admin
      .from("businesses")
      .select("id")
      .eq("slug", data)
      .single();
    if (business) await completeWorkspace(business.id, input);
    if (business)
      (await cookies()).set("studioflow-business", business.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
      });
    return respond({ slug: data }, 201);
  } catch (error) {
    return failure(error);
  }
}

/**
 * What create_workspace does not take: contact, identity, photos and the
 * team's WhatsApp. Same business, written right after it is created.
 */
async function completeWorkspace(
  businessId: string,
  input: z.infer<typeof onboardingSchema>,
) {
  const admin = createSupabaseAdmin();
  await admin
    .from("businesses")
    .update({
      description: input.description,
      phone: input.phone || "",
      address: input.address,
      instagram: input.instagram,
      logo: input.logo || null,
      color: input.color || null,
      photos: input.photos,
      amenities: input.amenities,
    })
    .eq("id", businessId);
  const [{ data: services }, { data: people }] = await Promise.all([
    admin.from("services").select("id,name").eq("business_id", businessId),
    admin.from("professionals").select("id,name").eq("business_id", businessId),
  ]);
  const used = new Set<string>();
  for (const item of input.services) {
    if (!item.image && !item.description) continue;
    const match = services?.find((service) => service.name === item.name && !used.has(service.id));
    if (!match) continue;
    used.add(match.id);
    await admin
      .from("services")
      .update({ image: item.image, description: item.description })
      .eq("business_id", businessId)
      .eq("id", match.id);
  }
  for (const person of input.team) {
    if (!person.phone && !person.photo) continue;
    const match = people?.find((item) => item.name === person.name);
    if (match)
      await admin
        .from("professionals")
        .update({ phone: person.phone, photo: person.photo })
        .eq("business_id", businessId)
        .eq("id", match.id);
  }
}
