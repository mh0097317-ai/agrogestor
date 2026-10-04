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
import {
  createSupabaseAdmin,
  createSupabaseServer,
  isPlatformAdmin,
} from "@/lib/supabase/server";
import type { Store } from "@/types";
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
}

/** No modo demonstração o acesso fica no próprio arquivo; sem registro, liberado. */
export const demoAccess = (store: Store): BusinessAccess =>
  store.access ?? { status: "active", until: null };

/** Só a equipe StudioFlow entra no painel da plataforma. */
export async function requirePlatformAdmin() {
  if (isDemo()) return { userId: null as string | null };
  const client = await createSupabaseServer();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new DomainError("Entre na sua conta para continuar.", 401);
  if (!(await isPlatformAdmin(user.id)))
    throw new DomainError("Esta área é só para a equipe StudioFlow.", 403);
  return { userId: user.id as string | null };
}

async function demoSlugs() {
  const directory = join(process.cwd(), ".data");
  await mkdir(directory, { recursive: true });
  const files = (await readdir(directory)).filter((file) =>
    /^business-[a-z0-9-]+\.json$/.test(file),
  );
  const slugs = files.map((file) => file.slice(9, -5));
  return slugs.includes("barber-011") ? slugs : ["barber-011", ...slugs];
}
function demoRow(store: Store, now: Date): PlatformBusiness {
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
      store.appointments.map((item) => item.createdAt).sort().at(-1) || null,
  };
}

export async function platformOverview(now = new Date()) {
  await requirePlatformAdmin();
  if (isDemo()) {
    const rows: PlatformBusiness[] = [];
    for (const slug of await demoSlugs())
      rows.push(demoRow(await readDemo(slug), now));
    return rows;
  }
  const { data, error } = await createSupabaseAdmin().rpc("platform_overview");
  if (error)
    throw new DomainError("Não foi possível carregar os estabelecimentos.", 503);
  return (data as Record<string, unknown>[]).map((row): PlatformBusiness => {
    const access: BusinessAccess = {
      status: row.status as BusinessAccess["status"],
      until: (row.access_until as string | null) ?? null,
    };
    return {
      id: row.id as string,
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
    };
  });
}

export async function platformEvents(businessId: string): Promise<AccessEvent[]> {
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
  if (error) throw new DomainError("Não foi possível carregar o histórico.", 503);
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

export async function platformAction(
  input: z.infer<typeof platformActionSchema>,
  now = new Date(),
) {
  const { userId } = await requirePlatformAdmin();
  const until =
    input.action === "until" ? endOfBusinessDay(input.date) : null;
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
