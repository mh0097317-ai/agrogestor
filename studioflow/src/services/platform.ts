import { randomUUID } from "node:crypto";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  accessState,
  endOfBusinessDay,
  extendUntil,
  type AccessEvent,
  type AccessState,
  type BusinessAccess,
} from "@/lib/access";
import { DomainError } from "@/lib/availability";
import { allModules, hasModule, type ModuleKey } from "@/lib/modules";
import { onlineBookingEnabled } from "@/lib/online-booking";
import {
  activityPeriod,
  demoActivity,
  emptyActivity,
  type ActivityPeriod,
  type PlatformActivity,
} from "@/lib/platform-activity";
import { evolutionReady } from "./whatsapp/evolution";
import { assistantModel } from "./assistant/agent";
import { createSupabaseAdmin, isPlatformAdmin } from "@/lib/supabase/server";
import type { Store } from "@/types";
import { createPlatformServer } from "./server-platform-auth";
import { isDemo, mutateDemo, readDemo } from "./server-demo";

/** Uma linha do painel da plataforma. */
export interface PlatformBusiness {
  id: string;
  name: string;
  slug: string;
  category: string;
  phone: string;
  image: string;
  createdAt: string;
  status: BusinessAccess["status"];
  until: string | null;
  note: string;
  state: AccessState;
  ownerName: string;
  ownerEmail: string;
  lastSignInAt: string | null;
  appointments30d: number;
  customers: number;
  lastAppointmentAt: string | null;
  /** null = todos os módulos. */
  modules: string[] | null;
  plan: string;
  price: number | null;
  onlineBookingEnabled: boolean;
  assistantEnabled: boolean;
  aiConfigured?: boolean;
  whatsappStatus: "open" | "connecting" | "close";
  activity: PlatformActivity;
}

export async function platformIntegrations() {
  return {
    evolution: await evolutionReady(),
    ai: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    model: assistantModel,
  };
}

export const platformChannelSchema = z
  .object({
    businessId: z.string().uuid(),
    channel: z.enum(["public_link", "receptionist"]),
    enabled: z.boolean(),
  })
  .strict();

export async function platformChannel(
  input: z.infer<typeof platformChannelSchema>,
) {
  const { userId } = await requirePlatformAdmin();
  if (isDemo()) {
    for (const slug of await demoSlugs()) {
      const store = await readDemo(slug);
      if (store.business.id !== input.businessId) continue;
      if (
        input.channel === "receptionist" &&
        input.enabled &&
        !hasModule(store.access?.modules, "recepcionista")
      )
        throw new DomainError(
          "Libere o módulo Recepcionista no plano primeiro.",
          409,
        );
      await mutateDemo((draft) => {
        if (input.channel === "public_link")
          draft.settings.onlineBookingEnabled = input.enabled;
        else draft.settings.assistantEnabled = input.enabled;
      }, slug);
      return;
    }
    throw new DomainError("Estabelecimento não encontrado.", 404);
  }
  if (input.channel === "receptionist" && input.enabled) {
    const { data, error } = await createSupabaseAdmin()
      .from("platform_access")
      .select("modules")
      .eq("business_id", input.businessId)
      .maybeSingle();
    if (error)
      throw new DomainError("Não foi possível consultar o plano.", 503);
    if (!hasModule(data?.modules, "recepcionista"))
      throw new DomainError(
        "Libere o módulo Recepcionista no plano primeiro.",
        409,
      );
  }
  const { error } = await createSupabaseAdmin().rpc("platform_set_channel", {
    p_business_id: input.businessId,
    p_actor: userId,
    p_channel: input.channel,
    p_enabled: input.enabled,
  });
  if (error)
    throw new DomainError(
      error.message === "business not found"
        ? "Estabelecimento não encontrado."
        : "Não foi possível salvar o canal.",
      error.message === "business not found" ? 404 : 503,
    );
}

export interface ChannelEvent {
  id: string;
  channel: "public_link" | "receptionist";
  enabled: boolean;
  createdAt: string;
}
export async function platformChannelEvents(
  businessId: string,
): Promise<ChannelEvent[]> {
  await requirePlatformAdmin();
  z.string().uuid().parse(businessId);
  if (isDemo()) return [];
  const { data, error } = await createSupabaseAdmin()
    .from("platform_channel_events")
    .select("id,channel,enabled,created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error)
    throw new DomainError(
      "Não foi possível carregar as mudanças de canais.",
      503,
    );
  return (data || []).map((row) => ({
    id: row.id,
    channel: row.channel,
    enabled: row.enabled,
    createdAt: row.created_at,
  }));
}

/** No modo demonstração o acesso fica no próprio arquivo; sem registro, liberado. */
export const demoAccess = (store: Store): BusinessAccess =>
  store.access ?? { status: "active", until: null };

/** Só a equipe StudioFlow entra no painel da plataforma. */
export async function requirePlatformAdmin() {
  if (isDemo()) return { userId: null as string | null };
  const client = await createPlatformServer();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new DomainError("Entre na sua conta para continuar.", 401);
  if (!(await isPlatformAdmin(user.id)))
    throw new DomainError("Esta área é só para a equipe StudioFlow.", 403);
  return { userId: user.id as string | null };
}

export async function demoSlugs() {
  const directory = join(process.cwd(), ".data");
  await mkdir(directory, { recursive: true });
  const files = (await readdir(directory)).filter((file) =>
    /^business-[a-z0-9-]+\.json$/.test(file),
  );
  const slugs = files.map((file) => file.slice(9, -5));
  return slugs.includes("barber-011") ? slugs : ["barber-011", ...slugs];
}
function demoRow(
  store: Store,
  now: Date,
  period: ActivityPeriod,
): PlatformBusiness {
  const access = demoAccess(store);
  const since = now.getTime() - 30 * 86_400_000;
  return {
    id: store.business.id,
    name: store.business.name,
    slug: store.business.slug,
    category: store.business.category,
    phone: store.business.phone,
    image: store.business.logo || store.business.cover || "",
    createdAt:
      store.accessEvents?.find((event) => event.action === "created")
        ?.createdAt || "2026-10-02T12:00:00.000Z",
    status: access.status,
    until: access.until,
    note: access.note || "",
    state: accessState(access, now),
    ownerName: "Demonstração",
    ownerEmail: "",
    lastSignInAt: null,
    appointments30d: store.appointments.filter(
      (item) =>
        item.status !== "cancelled" && new Date(item.start).getTime() > since,
    ).length,
    customers: store.customers.length,
    lastAppointmentAt:
      store.appointments
        .map((item) => item.createdAt)
        .sort()
        .at(-1) || null,
    modules: access.modules ?? null,
    plan: access.plan || "",
    price: access.price ?? null,
    onlineBookingEnabled: onlineBookingEnabled(store.settings),
    assistantEnabled: store.settings.assistantEnabled === true,
    whatsappStatus: store.whatsappLink?.status || "close",
    activity: demoActivity(store, period),
  };
}

export async function platformOverview(
  now = new Date(),
  period = activityPeriod(null, null, now),
) {
  await requirePlatformAdmin();
  if (isDemo()) {
    const rows: PlatformBusiness[] = [];
    for (const slug of await demoSlugs())
      rows.push(demoRow(await readDemo(slug), now, period));
    return rows;
  }
  const { data, error } = await createSupabaseAdmin().rpc("platform_overview");
  if (error)
    throw new DomainError(
      "Não foi possível carregar os estabelecimentos.",
      503,
    );
  const { data: settings, error: settingsError } = await createSupabaseAdmin()
    .from("business_settings")
    .select("business_id,online_booking_enabled,assistant_enabled");
  if (settingsError)
    throw new DomainError(
      "Não foi possível consultar os canais de agendamento.",
      503,
    );
  const { data: activity, error: activityError } =
    await createSupabaseAdmin().rpc("platform_activity", {
      p_from: period.from,
      p_to: period.to,
    });
  if (activityError)
    throw new DomainError("Não foi possível consultar os indicadores.", 503);
  const { data: links, error: linkError } = await createSupabaseAdmin()
    .from("whatsapp_links")
    .select("business_id,status");
  if (linkError)
    throw new DomainError(
      "Não foi possível consultar as conexões do WhatsApp.",
      503,
    );
  const online = new Map((settings || []).map((row) => [row.business_id, row]));
  const activities = new Map(
    (activity as (PlatformActivity & { businessId: string })[]).map((row) => [
      row.businessId,
      row,
    ]),
  );
  const connections = new Map(
    (links || []).map((row) => [row.business_id, row.status]),
  );
  const { data: credentials, error: credentialsError } =
    await createSupabaseAdmin()
      .from("business_ai_credentials")
      .select("business_id");
  if (credentialsError)
    throw new DomainError(
      "Não foi possível conferir as credenciais da recepcionista.",
      503,
    );
  const configured = new Set((credentials || []).map((row) => row.business_id));
  return (data as Record<string, unknown>[]).map((row): PlatformBusiness => {
    const access: BusinessAccess = {
      status: row.status as BusinessAccess["status"],
      until: (row.access_until as string | null) ?? null,
    };
    return {
      id: row.id as string,
      onlineBookingEnabled: online.get(row.id)?.online_booking_enabled === true,
      assistantEnabled: online.get(row.id)?.assistant_enabled === true,
      whatsappStatus: connections.get(row.id) || "close",
      activity: activities.get(row.id as string) || emptyActivity(),
      name: row.name as string,
      slug: row.slug as string,
      category: row.category as string,
      phone: (row.phone as string) || "",
      image: (row.logo as string) || (row.cover as string) || "",
      createdAt: row.created_at as string,
      status: access.status,
      until: access.until,
      note: (row.note as string) || "",
      state: accessState(access, now),
      ownerName: (row.owner_name as string) || "",
      ownerEmail: (row.owner_email as string) || "",
      lastSignInAt: (row.last_sign_in_at as string | null) ?? null,
      appointments30d: Number(row.appointments_30d) || 0,
      customers: Number(row.customers) || 0,
      lastAppointmentAt: (row.last_appointment_at as string | null) ?? null,
      aiConfigured: configured.has(row.id),
      modules: (row.modules as string[] | null | undefined) ?? null,
      plan: (row.plan as string) || "",
      price:
        row.monthly_price === null || row.monthly_price === undefined
          ? null
          : Number(row.monthly_price),
    };
  });
}

export async function platformEvents(
  businessId: string,
): Promise<AccessEvent[]> {
  await requirePlatformAdmin();
  z.string().uuid().parse(businessId);
  if (isDemo()) {
    for (const slug of await demoSlugs()) {
      const store = await readDemo(slug);
      if (store.business.id === businessId)
        return [...(store.accessEvents || [])].reverse();
    }
    throw new DomainError("Estabelecimento não encontrado.", 404);
  }
  const { data, error } = await createSupabaseAdmin()
    .from("platform_access_events")
    .select("id,action,days,access_until,created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error)
    throw new DomainError("Não foi possível carregar o histórico.", 503);
  return (data || []).map((row) => ({
    id: row.id,
    action: row.action,
    days: row.days,
    until: row.access_until,
    createdAt: row.created_at,
  }));
}

export const platformActionSchema = z.discriminatedUnion("action", [
  z.object({
    businessId: z.string().uuid(),
    action: z.literal("granted"),
    days: z.number().int().min(1, "Libere pelo menos 1 dia.").max(3660),
  }),
  z.object({
    businessId: z.string().uuid(),
    action: z.literal("until"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data válida."),
  }),
  z.object({
    businessId: z.string().uuid(),
    action: z.enum(["unlimited", "suspended", "pending"]),
  }),
  z.object({
    businessId: z.string().uuid(),
    action: z.literal("note"),
    note: z.string().trim().max(500, "Anotação muito longa."),
  }),
]);

export const platformPlanSchema = z.object({
  businessId: z.string().uuid(),
  plan: z.string().trim().max(40),
  price: z.number().min(0).max(100000).nullable(),
  modules: z
    .array(z.enum(allModules as [ModuleKey, ...ModuleKey[]]))
    .max(allModules.length),
});

/** Plano, mensalidade e módulos que o cliente contratou. */
export async function platformPlan(
  input: z.infer<typeof platformPlanSchema>,
  now = new Date(),
) {
  const { userId } = await requirePlatformAdmin();
  const modules = [...new Set(input.modules)].sort();
  if (isDemo()) {
    for (const slug of await demoSlugs()) {
      const store = await readDemo(slug);
      if (store.business.id !== input.businessId) continue;
      await mutateDemo((draft) => {
        draft.access = {
          ...demoAccess(draft),
          modules,
          plan: input.plan,
          price: input.price,
        };
        draft.accessEvents = [
          ...(draft.accessEvents || []),
          {
            id: randomUUID(),
            action: "plan" as const,
            days: null,
            until: draft.access.until,
            createdAt: now.toISOString(),
          },
        ].slice(-50);
      }, slug);
      return;
    }
    throw new DomainError("Estabelecimento não encontrado.", 404);
  }
  const { error } = await createSupabaseAdmin().rpc("platform_set_plan", {
    p_business_id: input.businessId,
    p_actor: userId,
    p_plan: input.plan,
    p_price: input.price,
    p_modules: modules,
  });
  if (error)
    throw new DomainError(
      error.message === "business not found"
        ? "Estabelecimento não encontrado."
        : "Não foi possível salvar o plano.",
      error.message === "business not found" ? 404 : 409,
    );
}

export async function platformAction(
  input: z.infer<typeof platformActionSchema>,
  now = new Date(),
) {
  const { userId } = await requirePlatformAdmin();
  const until = input.action === "until" ? endOfBusinessDay(input.date) : null;
  if (until && new Date(until) <= now)
    throw new DomainError("Escolha uma data a partir de hoje.");
  if (isDemo()) {
    for (const slug of await demoSlugs()) {
      const store = await readDemo(slug);
      if (store.business.id !== input.businessId) continue;
      await mutateDemo((draft) => {
        const access = { ...demoAccess(draft) };
        if (input.action === "granted") {
          access.status = "active";
          access.until = extendUntil(access.until, input.days, now);
        } else if (input.action === "until") {
          access.status = "active";
          access.until = until;
        } else if (input.action === "unlimited") {
          access.status = "active";
          access.until = null;
        } else if (input.action === "note") access.note = input.note;
        else access.status = input.action;
        draft.access = access;
        draft.accessEvents = [
          ...(draft.accessEvents || []),
          {
            id: randomUUID(),
            action: input.action,
            days: input.action === "granted" ? input.days : null,
            until: access.until,
            createdAt: now.toISOString(),
          },
        ].slice(-50);
      }, slug);
      return;
    }
    throw new DomainError("Estabelecimento não encontrado.", 404);
  }
  const { error } = await createSupabaseAdmin().rpc("platform_set_access", {
    p_business_id: input.businessId,
    p_actor: userId,
    p_action: input.action,
    p_days: input.action === "granted" ? input.days : null,
    p_until: until,
    p_note: input.action === "note" ? input.note : null,
  });
  if (error)
    throw new DomainError(
      error.message === "business not found"
        ? "Estabelecimento não encontrado."
        : "Não foi possível salvar a liberação.",
      error.message === "business not found" ? 404 : 409,
    );
}
