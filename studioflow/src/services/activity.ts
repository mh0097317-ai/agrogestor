import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { after } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isDemo } from "./server-demo";

/**
 * Auditoria do estabelecimento, lida pela equipe StudioFlow no /admin.
 * Por dentro: o que a equipe da loja faz no painel. Por fora: o que os
 * clientes fazem na página (visitas e cliques) e o que o sistema envia.
 * Gravar nunca derruba a ação principal: falhas só vão para o log.
 */
export type ActivitySource = "painel" | "cliente" | "recepcionista" | "sistema" | "plataforma";
export interface ActivityEntry {
  source: ActivitySource;
  action: string;
  detail?: string;
  actor?: string;
  actorId?: string | null;
}
export interface ActivityRow {
  id: string;
  source: ActivitySource;
  action: string;
  detail: string;
  actor: string;
  createdAt: string;
}
export const pageEventKinds = [
  "view",
  "agendar",
  "whatsapp",
  "instagram",
  "localizacao",
  "compartilhar",
  "chat",
  "clube",
  "etapa",
  "agendou",
] as const;
export type PageEventKind = (typeof pageEventKinds)[number];
export interface PageEvent {
  visitor: string;
  kind: PageEventKind;
  detail: string;
  device: "" | "celular" | "computador" | "tablet";
  referrer: string;
  createdAt: string;
}

/* Demonstração: um arquivo por estabelecimento, fora do cadastro. */
const demoFile = (businessId: string) =>
  join(process.cwd(), ".data", `audit-${businessId.replace(/[^a-z0-9-]/gi, "")}.json`);
interface DemoAudit {
  activity: ActivityRow[];
  events: PageEvent[];
}
async function readDemoAudit(businessId: string): Promise<DemoAudit> {
  try {
    const data = JSON.parse(await readFile(demoFile(businessId), "utf8")) as DemoAudit;
    return { activity: data.activity || [], events: data.events || [] };
  } catch {
    return { activity: [], events: [] };
  }
}
async function writeDemoAudit(businessId: string, change: (audit: DemoAudit) => void) {
  const audit = await readDemoAudit(businessId);
  change(audit);
  audit.activity = audit.activity.slice(-500);
  audit.events = audit.events.slice(-3000);
  await mkdir(join(process.cwd(), ".data"), { recursive: true });
  await writeFile(demoFile(businessId), JSON.stringify(audit));
}

const clip = (value: string | undefined, max: number) => (value || "").replace(/\s+/g, " ").trim().slice(0, max);

export async function logActivity(businessId: string, entry: ActivityEntry) {
  const row = {
    source: entry.source,
    action: clip(entry.action, 60) || "ação",
    detail: clip(entry.detail, 400),
    actor: clip(entry.actor, 120),
  };
  try {
    if (isDemo()) {
      await writeDemoAudit(businessId, (audit) => {
        audit.activity.push({
          id: `${Date.now()}-${audit.activity.length}`,
          ...row,
          createdAt: new Date().toISOString(),
        });
      });
      return;
    }
    const { error } = await createSupabaseAdmin()
      .from("activity_log")
      .insert({ business_id: businessId, actor_id: entry.actorId || null, ...row });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("StudioFlow activity log error:", error instanceof Error ? error.message : "unknown");
  }
}

export async function logPageEvent(businessId: string, event: Omit<PageEvent, "createdAt">) {
  const row = {
    visitor: clip(event.visitor, 64),
    kind: event.kind,
    detail: clip(event.detail, 60),
    device: event.device,
    referrer: clip(event.referrer, 80),
  };
  try {
    if (isDemo()) {
      await writeDemoAudit(businessId, (audit) => {
        audit.events.push({ ...row, createdAt: new Date().toISOString() });
      });
      return;
    }
    const { error } = await createSupabaseAdmin()
      .from("page_events")
      .insert({ business_id: businessId, ...row });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("StudioFlow page event error:", error instanceof Error ? error.message : "unknown");
  }
}

/** Tudo desde `since`, para a auditoria. */
export async function readAudit(businessId: string, since: string) {
  if (isDemo()) {
    const audit = await readDemoAudit(businessId);
    return {
      activity: audit.activity.filter((row) => row.createdAt >= since).reverse(),
      events: audit.events.filter((row) => row.createdAt >= since),
    };
  }
  const admin = createSupabaseAdmin();
  const [activity, events] = await Promise.all([
    admin
      .from("activity_log")
      .select("id,source,action,detail,actor,created_at")
      .eq("business_id", businessId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(400),
    admin
      .from("page_events")
      .select("visitor,kind,detail,device,referrer,created_at")
      .eq("business_id", businessId)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(20000),
  ]);
  return {
    activity: (activity.data || []).map((row) => ({
      id: String(row.id),
      source: row.source as ActivitySource,
      action: row.action as string,
      detail: row.detail as string,
      actor: row.actor as string,
      createdAt: row.created_at as string,
    })),
    events: (events.data || []).map((row) => ({
      visitor: row.visitor as string,
      kind: row.kind as PageEventKind,
      detail: row.detail as string,
      device: row.device as PageEvent["device"],
      referrer: row.referrer as string,
      createdAt: row.created_at as string,
    })),
  };
}

/** "06/10 às 14:00", no horário de São Paulo. */
export function activityWhen(iso: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("day")}/${get("month")} às ${get("hour")}:${get("minute")}`;
}

/**
 * Registra uma ação do painel depois da resposta, com quem fez. Usada nas
 * rotas do painel que não passam pela mutação genérica.
 */
export function auditPanel(action: string, detail = "") {
  after(async () => {
    try {
      if (isDemo()) {
        const { readDemo } = await import("./server-demo");
        const { demoWorkspaceSlug } = await import("./server-store");
        const store = await readDemo(await demoWorkspaceSlug());
        await logActivity(store.business.id, { source: "painel", action, detail, actor: "João Pedro" });
        return;
      }
      const { requireMembership } = await import("@/lib/supabase/server");
      const { businessId, user } = await requireMembership({ allowClosed: true });
      const meta = (user.user_metadata || {}) as Record<string, unknown>;
      await logActivity(businessId, {
        source: "painel",
        action,
        detail,
        actor: String(meta.name || meta.full_name || user.email || ""),
        actorId: user.id,
      });
    } catch (error) {
      console.error("StudioFlow audit error:", error instanceof Error ? error.message : "unknown");
    }
  });
}
