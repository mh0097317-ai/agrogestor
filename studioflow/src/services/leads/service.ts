import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { marketingAiCredentials } from "../marketing/service";
import { requirePlatformAdmin } from "../platform";
import { isDemo } from "../server-demo";
import { openVault, sealVault } from "../server-secrets";
import {
  instagramHandle,
  leadStatuses,
  normalizePhone,
  readSite,
  scoreLead,
  type LeadSignals,
  type LeadStatus,
} from "./lead-logic";
import { writeLeadMessage } from "./message";
import {
  demoPlaces,
  searchOpenStreetMap,
  searchSerperMaps,
  type FoundPlace,
} from "./providers";
import { fetchPublicPage } from "./safe-fetch";

/*
 * Captação: a StudioFlow acha barbearias, lê o site de cada uma, dá nota e
 * escreve a primeira mensagem. Quem envia é a equipe, pelo próprio
 * WhatsApp, com um toque. Quem pede para não receber sai de vez.
 */

const vaultScope = "platform:serper";
const FOLLOW_UP_DAYS = 3;

export interface Lead {
  id: string;
  placeId: string | null;
  name: string;
  phone: string;
  website: string;
  instagram: string;
  address: string;
  city: string;
  category: string;
  rating: number | null;
  reviews: number | null;
  mapsUrl: string;
  source: "google_maps" | "openstreetmap" | "manual";
  signals: LeadSignals;
  score: number;
  reasons: string[];
  status: LeadStatus;
  message: string;
  notes: string;
  contactedAt: string | null;
  followUpAt: string | null;
  profiledAt: string | null;
  businessId: string | null;
  createdAt: string;
}

export interface LeadsView {
  leads: Lead[];
  counts: Record<LeadStatus, number>;
  dueFollowUps: number;
  settings: {
    serper: "admin" | "environment" | null;
    hint: string;
    senderName: string;
    searches: number;
    ai: boolean;
  };
  demo: boolean;
}

const statusIds = leadStatuses.map((item) => item.id) as [LeadStatus, ...LeadStatus[]];

export const leadActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("search"),
    city: z.string().trim().min(2, "Informe a cidade.").max(120),
    term: z.string().trim().min(3).max(60).default("barbearia"),
    provider: z.enum(["serper", "openstreetmap"]),
    pages: z.number().int().min(1).max(3).default(1),
  }),
  z.object({ kind: z.literal("profile"), id: z.string().uuid() }),
  z.object({ kind: z.literal("profilePending") }),
  z.object({ kind: z.literal("draft"), id: z.string().uuid() }),
  z.object({ kind: z.literal("contacted"), id: z.string().uuid() }),
  z.object({
    kind: z.literal("update"),
    id: z.string().uuid(),
    status: z.enum(statusIds).optional(),
    notes: z.string().max(2000).optional(),
    message: z.string().max(1200).optional(),
    followUpDays: z.number().int().min(0).max(60).nullable().optional(),
  }),
  z.object({
    kind: z.literal("manual"),
    name: z.string().trim().min(2, "Informe o nome da barbearia.").max(200),
    phone: z.string().max(25).default(""),
    instagram: z.string().max(100).default(""),
    city: z.string().trim().max(120).default(""),
  }),
  z.object({
    kind: z.literal("settings"),
    senderName: z.string().trim().max(60).optional(),
    serperKey: z.string().trim().max(200).optional(),
    removeSerper: z.boolean().optional(),
  }),
]);
export type LeadAction = z.infer<typeof leadActionSchema>;

type Row = Record<string, unknown>;

const toLead = (row: Row): Lead => ({
  id: row.id as string,
  placeId: (row.place_id as string) || null,
  name: row.name as string,
  phone: (row.phone as string) || "",
  website: (row.website as string) || "",
  instagram: (row.instagram as string) || "",
  address: (row.address as string) || "",
  city: (row.city as string) || "",
  category: (row.category as string) || "",
  rating: row.rating == null ? null : Number(row.rating),
  reviews: row.reviews == null ? null : Number(row.reviews),
  mapsUrl: (row.maps_url as string) || "",
  source: row.source as Lead["source"],
  signals: (row.signals as LeadSignals) || {},
  score: Number(row.score) || 0,
  reasons: (row.reasons as string[]) || [],
  status: row.status as LeadStatus,
  message: (row.message as string) || "",
  notes: (row.notes as string) || "",
  contactedAt: (row.contacted_at as string) || null,
  followUpAt: (row.follow_up_at as string) || null,
  profiledAt: (row.profiled_at as string) || null,
  businessId: (row.business_id as string) || null,
  createdAt: row.created_at as string,
});

const toRow = (lead: Partial<Lead>): Row => {
  const row: Row = {};
  const map: Record<string, string> = {
    placeId: "place_id",
    mapsUrl: "maps_url",
    contactedAt: "contacted_at",
    followUpAt: "follow_up_at",
    profiledAt: "profiled_at",
    businessId: "business_id",
    createdAt: "created_at",
  };
  for (const [key, value] of Object.entries(lead))
    if (value !== undefined) row[map[key] || key] = value;
  return row;
};

/* ------------------------------------------------------------------ */
/* Armazenamento: Supabase no ar, um arquivo na demonstração local.     */
/* ------------------------------------------------------------------ */

const demoFile = () => join(process.cwd(), ".data", "platform-leads.json");
interface DemoData {
  leads: Lead[];
  senderName: string;
  searches: number;
}
async function readDemoData(): Promise<DemoData> {
  try {
    return JSON.parse(await readFile(demoFile(), "utf8"));
  } catch {
    return { leads: [], senderName: "", searches: 0 };
  }
}
async function writeDemoData(data: DemoData) {
  await mkdir(join(process.cwd(), ".data"), { recursive: true });
  await writeFile(demoFile(), JSON.stringify(data));
}

async function allLeads(): Promise<Lead[]> {
  if (isDemo()) return (await readDemoData()).leads;
  const { data, error } = await createSupabaseAdmin()
    .from("platform_leads")
    .select("*")
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new DomainError("Não foi possível ler os leads.", 503);
  return (data || []).map(toLead);
}

async function oneLead(id: string): Promise<Lead> {
  const lead = (await allLeads()).find((item) => item.id === id);
  if (!lead) throw new DomainError("Lead não encontrado.", 404);
  return lead;
}

async function saveLead(id: string, patch: Partial<Lead>) {
  if (isDemo()) {
    const data = await readDemoData();
    data.leads = data.leads.map((item) => (item.id === id ? { ...item, ...patch } : item));
    await writeDemoData(data);
    return;
  }
  const { error } = await createSupabaseAdmin().from("platform_leads").update(toRow(patch)).eq("id", id);
  if (error) throw new DomainError("Não foi possível salvar o lead.", 503);
}

async function logEvent(leadId: string, kind: string, detail: Row, actor: string | null) {
  if (isDemo()) return;
  await createSupabaseAdmin()
    .from("platform_lead_events")
    .insert({ lead_id: leadId, kind, detail, actor })
    .then(() => undefined, () => undefined);
}

async function settingsRow() {
  if (isDemo()) {
    const data = await readDemoData();
    return { serper_key_enc: null, serper_hint: "", sender_name: data.senderName, searches: data.searches };
  }
  const { data } = await createSupabaseAdmin()
    .from("platform_lead_settings")
    .select("serper_key_enc,serper_hint,sender_name,searches")
    .eq("id", "default")
    .maybeSingle();
  return data || { serper_key_enc: null, serper_hint: "", sender_name: "", searches: 0 };
}

function serperKeyOf(row: { serper_key_enc: string | null }) {
  if (process.env.SERPER_API_KEY) return process.env.SERPER_API_KEY;
  if (!row.serper_key_enc) return "";
  try {
    return openVault(row.serper_key_enc, vaultScope);
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */

const facts = (lead: Lead) => ({
  name: lead.name,
  phone: lead.phone,
  website: lead.website,
  instagram: lead.instagram,
  rating: lead.rating,
  reviews: lead.reviews,
  city: lead.city,
  signals: lead.signals,
});

/** Lê o site e recalcula a nota. Sem site, a nota já sai do que o Maps deu. */
async function profile(lead: Lead): Promise<Partial<Lead>> {
  let signals: LeadSignals = { ...lead.signals };
  let instagram = lead.instagram;
  if (lead.website && !isDemo()) {
    const page = await fetchPublicPage(lead.website);
    if (page.ok) {
      const site = readSite(page.html);
      signals = {
        bookingTool: site.bookingTool,
        usesStudioFlow: site.usesStudioFlow,
        whatsappOnSite: site.whatsappOnSite,
        siteRead: true,
      };
      instagram = instagram || site.instagram;
    } else signals = { ...signals, siteRead: false, siteError: page.error };
  } else if (lead.website && isDemo()) {
    signals = { bookingTool: lead.name.startsWith("Vintage") ? "Booksy" : null, siteRead: true };
  }
  const { score, reasons } = scoreLead({ ...facts(lead), instagram, signals });
  return {
    signals,
    instagram,
    score,
    reasons,
    profiledAt: new Date().toISOString(),
    ...(signals.usesStudioFlow && lead.status === "new" ? { status: "customer" as const } : {}),
  };
}

async function pool<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await run(queue.shift()!);
    }),
  );
}

/** Quem se cadastrou na StudioFlow com o mesmo WhatsApp vira "Em teste". */
async function linkSignups(leads: Lead[]) {
  if (isDemo()) return leads;
  const open = leads.filter((lead) => lead.phone && !lead.businessId && !["customer", "opted_out"].includes(lead.status));
  if (!open.length) return leads;
  const { data } = await createSupabaseAdmin()
    .from("businesses")
    .select("id,phone")
    .in("phone", [...new Set(open.map((lead) => lead.phone))]);
  if (!data?.length) return leads;
  const byPhone = new Map(data.map((row) => [row.phone as string, row.id as string]));
  for (const lead of open) {
    const businessId = byPhone.get(lead.phone);
    if (!businessId) continue;
    lead.businessId = businessId;
    lead.status = "trial";
    await saveLead(lead.id, { businessId, status: "trial" });
    await logEvent(lead.id, "status", { status: "trial", reason: "signup" }, null);
  }
  return leads;
}

export async function leadsView(): Promise<LeadsView> {
  await requirePlatformAdmin();
  const leads = await linkSignups(await allLeads());
  const settings = await settingsRow();
  const counts = Object.fromEntries(leadStatuses.map((item) => [item.id, 0])) as Record<LeadStatus, number>;
  for (const lead of leads) counts[lead.status] += 1;
  const now = Date.now();
  const ai = isDemo() ? false : !!(await marketingAiCredentials().catch(() => null));
  return {
    leads,
    counts,
    dueFollowUps: leads.filter(
      (lead) =>
        lead.followUpAt &&
        Date.parse(lead.followUpAt) <= now &&
        ["contacted", "replied", "demo"].includes(lead.status),
    ).length,
    settings: {
      serper: process.env.SERPER_API_KEY ? "environment" : settings.serper_key_enc ? "admin" : null,
      hint: process.env.SERPER_API_KEY ? process.env.SERPER_API_KEY.slice(-4) : settings.serper_hint || "",
      senderName: settings.sender_name || "",
      searches: settings.searches || 0,
      ai,
    },
    demo: isDemo(),
  };
}

async function search(input: Extract<LeadAction, { kind: "search" }>, actor: string | null) {
  const settings = await settingsRow();
  let places: FoundPlace[];
  if (isDemo()) places = demoPlaces(input.city);
  else if (input.provider === "serper") {
    const apiKey = serperKeyOf(settings);
    if (!apiKey)
      throw new DomainError("Cadastre a chave da Serper em Captação → Fonte de barbearias.", 409);
    places = await searchSerperMaps({ apiKey, term: input.term, city: input.city, pages: input.pages });
  } else places = await searchOpenStreetMap({ city: input.city });

  const existing = await allLeads();
  const seen = new Set(existing.flatMap((lead) => [lead.placeId || "", lead.phone ? `p:${lead.phone}` : ""]));
  const fresh: Lead[] = [];
  for (const place of places) {
    if (seen.has(place.placeId) || (place.phone && seen.has(`p:${place.phone}`))) continue;
    seen.add(place.placeId);
    if (place.phone) seen.add(`p:${place.phone}`);
    const base: Lead = {
      id: randomUUID(),
      placeId: place.placeId,
      name: place.name,
      phone: place.phone,
      website: place.website,
      instagram: place.instagram,
      address: place.address,
      city: input.city.slice(0, 120),
      category: place.category,
      rating: place.rating,
      reviews: place.reviews,
      mapsUrl: place.mapsUrl,
      source: place.source,
      signals: {},
      score: 0,
      reasons: [],
      status: "new",
      message: "",
      notes: "",
      contactedAt: null,
      followUpAt: null,
      profiledAt: null,
      businessId: null,
      createdAt: new Date().toISOString(),
    };
    Object.assign(base, scoreLead(facts(base)));
    fresh.push(base);
  }
  // O site das primeiras é lido já; o resto fica para "Investigar pendentes".
  await pool(fresh.filter((lead) => lead.website).slice(0, 12), 4, async (lead) => {
    Object.assign(lead, await profile(lead));
  });
  for (const lead of fresh) if (!lead.website) lead.profiledAt = new Date().toISOString();

  if (isDemo()) {
    const data = await readDemoData();
    data.leads = [...fresh, ...data.leads];
    data.searches += 1;
    await writeDemoData(data);
  } else if (fresh.length) {
    const { error } = await createSupabaseAdmin()
      .from("platform_leads")
      .upsert(fresh.map((lead) => toRow(lead)), { onConflict: "place_id", ignoreDuplicates: true });
    if (error) throw new DomainError("Não foi possível guardar os leads encontrados.", 503);
    await createSupabaseAdmin()
      .from("platform_lead_events")
      .insert(fresh.map((lead) => ({ lead_id: lead.id, kind: "found", detail: { source: lead.source, city: lead.city }, actor })))
      .then(() => undefined, () => undefined);
  }
  if (!isDemo())
    await createSupabaseAdmin()
      .from("platform_lead_settings")
      .update({ searches: (settings.searches || 0) + input.pages })
      .eq("id", "default");
  return { found: places.length, added: fresh.length };
}

export async function leadAction(action: LeadAction) {
  const { userId } = await requirePlatformAdmin();
  switch (action.kind) {
    case "search": {
      const result = await search(action, userId);
      return { ...result, view: await leadsView() };
    }
    case "profile": {
      const lead = await oneLead(action.id);
      const patch = await profile(lead);
      await saveLead(lead.id, patch);
      await logEvent(lead.id, "profiled", { signals: patch.signals, score: patch.score }, userId);
      return { view: await leadsView() };
    }
    case "profilePending": {
      const pending = (await allLeads()).filter((lead) => !lead.profiledAt && lead.website).slice(0, 15);
      await pool(pending, 4, async (lead) => {
        const patch = await profile(lead);
        await saveLead(lead.id, patch);
      });
      return { profiled: pending.length, view: await leadsView() };
    }
    case "draft": {
      const lead = await oneLead(action.id);
      if (lead.status === "opted_out")
        throw new DomainError("Essa barbearia pediu para não receber mensagens.", 409);
      const settings = await settingsRow();
      const ai = await marketingAiCredentials().catch(() => null);
      const { message, source } = await writeLeadMessage(facts(lead), settings.sender_name || "", ai);
      await saveLead(lead.id, { message });
      await logEvent(lead.id, "drafted", { source }, userId);
      return { message, source, view: await leadsView() };
    }
    case "contacted": {
      const lead = await oneLead(action.id);
      if (lead.status === "opted_out")
        throw new DomainError("Essa barbearia pediu para não receber mensagens.", 409);
      const now = new Date();
      const patch: Partial<Lead> = {
        contactedAt: now.toISOString(),
        followUpAt: new Date(now.getTime() + FOLLOW_UP_DAYS * 86_400_000).toISOString(),
        ...(lead.status === "new" ? { status: "contacted" as const } : {}),
      };
      await saveLead(lead.id, patch);
      await logEvent(lead.id, "contacted", { channel: "whatsapp" }, userId);
      return { view: await leadsView() };
    }
    case "update": {
      const lead = await oneLead(action.id);
      const patch: Partial<Lead> = {};
      if (action.notes !== undefined) patch.notes = action.notes;
      if (action.message !== undefined) patch.message = action.message;
      if (action.followUpDays !== undefined)
        patch.followUpAt =
          action.followUpDays === null
            ? null
            : new Date(Date.now() + action.followUpDays * 86_400_000).toISOString();
      if (action.status) {
        patch.status = action.status;
        // Pediu para sair: some o lembrete e a mensagem pronta, para sempre.
        if (action.status === "opted_out") Object.assign(patch, { followUpAt: null, message: "" });
        if (["customer", "lost"].includes(action.status)) patch.followUpAt = null;
      }
      await saveLead(lead.id, patch);
      await logEvent(lead.id, action.status ? "status" : "note", { status: action.status }, userId);
      return { view: await leadsView() };
    }
    case "manual": {
      const phone = normalizePhone(action.phone);
      const instagram = instagramHandle(action.instagram);
      if (!phone && !instagram) throw new DomainError("Informe o WhatsApp ou o Instagram da barbearia.");
      const lead: Lead = {
        id: randomUUID(),
        placeId: null,
        name: action.name,
        phone,
        website: "",
        instagram,
        address: "",
        city: action.city,
        category: "Barbearia",
        rating: null,
        reviews: null,
        mapsUrl: "",
        source: "manual",
        signals: {},
        score: 0,
        reasons: [],
        status: "new",
        message: "",
        notes: "",
        contactedAt: null,
        followUpAt: null,
        profiledAt: new Date().toISOString(),
        businessId: null,
        createdAt: new Date().toISOString(),
      };
      Object.assign(lead, scoreLead(facts(lead)));
      if ((await allLeads()).some((item) => phone && item.phone === phone))
        throw new DomainError("Esse WhatsApp já está na lista.", 409);
      if (isDemo()) {
        const data = await readDemoData();
        data.leads = [lead, ...data.leads];
        await writeDemoData(data);
      } else {
        const { error } = await createSupabaseAdmin().from("platform_leads").insert(toRow(lead));
        if (error) throw new DomainError("Não foi possível adicionar.", 503);
        await logEvent(lead.id, "found", { source: "manual" }, userId);
      }
      return { view: await leadsView() };
    }
    case "settings": {
      if (isDemo()) {
        const data = await readDemoData();
        if (action.senderName !== undefined) data.senderName = action.senderName;
        await writeDemoData(data);
        return { view: await leadsView() };
      }
      const patch: Row = { updated_by: userId, updated_at: new Date().toISOString() };
      if (action.senderName !== undefined) patch.sender_name = action.senderName;
      if (action.removeSerper) Object.assign(patch, { serper_key_enc: null, serper_hint: "" });
      else if (action.serperKey) {
        const valid = await searchSerperMaps({ apiKey: action.serperKey, term: "barbearia", city: "Goiânia", pages: 1 })
          .then(() => true)
          .catch((cause) => {
            if (cause instanceof DomainError && cause.status === 409) return false;
            throw cause;
          });
        if (!valid) throw new DomainError("A Serper não aceitou essa chave. Copie de novo do painel dela.", 409);
        Object.assign(patch, {
          serper_key_enc: sealVault(action.serperKey, vaultScope),
          serper_hint: action.serperKey.slice(-4),
        });
      }
      const { error } = await createSupabaseAdmin().from("platform_lead_settings").update(patch).eq("id", "default");
      if (error) throw new DomainError("Não foi possível salvar.", 503);
      return { view: await leadsView() };
    }
  }
}
