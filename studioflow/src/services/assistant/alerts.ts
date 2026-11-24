import { appUrl } from "@/lib/app-url";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isDemo } from "../server-demo";
import { getPublicStore } from "../server-store";
import { ownerPhone } from "../attendance";
import { noticeSender, saveLinkState } from "../whatsapp/link";
import { connectInstance, instanceState } from "../whatsapp/evolution";
import { brandEmail } from "../email/brand-email";
import { emailConfigured, sendEmail } from "../email/resend";
import { platformAiEnabled } from "../platform-ai-control";

/*
 * Avisos ao dono quando a recepcionista não dá conta: uma conversa falhou,
 * um cliente está esperando resposta ou o WhatsApp da loja desconectou.
 * Vão pelo WhatsApp da loja para o dono e, sem WhatsApp, por e-mail. Cada
 * aviso sai uma vez por conversa e no máximo seis por loja por dia.
 */

export type AlertKind = "failed" | "no_reply" | "disconnected";
const dailyLimit = 6;

const tail = (phone: string) => phone.replace(/\D/g, "").slice(-4);
const panel = `${appUrl}/dashboard/conversas`;

/** Whether this alert may go out now; records it when it may. */
async function claim(
  businessId: string,
  kind: AlertKind,
  conversationId: string | null,
  repeatHours: number,
) {
  const admin = createSupabaseAdmin();
  const since = new Date(Date.now() - repeatHours * 3_600_000).toISOString();
  const day = new Date(Date.now() - 86_400_000).toISOString();
  // Aviso que não chegou a ninguém (channel "none") não conta: o próximo sai.
  const delivered = "channel.is.null,channel.neq.none";
  let same = admin
    .from("assistant_alerts")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("kind", kind)
    .or(delivered)
    .gte("created_at", since);
  same = conversationId
    ? same.eq("conversation_id", conversationId)
    : same.is("conversation_id", null);
  const [repeated, today] = await Promise.all([
    same,
    admin
      .from("assistant_alerts")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .or(delivered)
      .gte("created_at", day),
  ]);
  if (repeated.error || today.error) return null;
  if ((repeated.count || 0) > 0 || (today.count || 0) >= dailyLimit)
    return null;
  const { data, error } = await admin
    .from("assistant_alerts")
    .insert({ business_id: businessId, kind, conversation_id: conversationId })
    .select("id")
    .single();
  return error ? null : (data.id as string);
}

async function ownerEmail(businessId: string) {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("business_members")
    .select("user_id")
    .eq("business_id", businessId)
    .eq("role", "owner")
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (!data?.user_id) return "";
  const user = await admin.auth.admin.getUserById(data.user_id as string);
  return user.data.user?.email || "";
}

function message(
  kind: AlertKind,
  shop: string,
  phone: string,
  minutes = 0,
  who = "",
) {
  if (kind === "failed")
    return `⚠️ StudioFlow: a recepcionista da ${shop} não conseguiu responder o cliente de final ${tail(phone)}. A conversa passou para a equipe, responda por aqui: ${panel}`;
  if (kind === "no_reply")
    return `⏱️ StudioFlow: o cliente de final ${tail(phone)} está esperando resposta há ${minutes} min na ${shop}. Dá uma olhada: ${panel}`;
  return `⚠️ StudioFlow: o WhatsApp ${who ? `de ${who}, na ${shop},` : `da ${shop}`} desconectou. Lembretes e a recepcionista param até reconectar. Leia o QR Code de novo em Configurações → WhatsApp: ${appUrl}/dashboard/configuracoes?aba=whatsapp`;
}

/** Tells the owner, once, by WhatsApp and otherwise by e-mail. Never throws. */
export async function alertOwner(input: {
  businessId: string;
  kind: AlertKind;
  conversationId?: string | null;
  phone?: string;
  minutes?: number;
  /** De quem é o número que caiu, quando não é o da casa. */
  who?: string;
}) {
  if (isDemo()) return "none" as const;
  try {
    const id = await claim(
      input.businessId,
      input.kind,
      input.conversationId || null,
      input.kind === "disconnected" ? 12 : 2,
    );
    if (!id) return "none" as const;
    const admin = createSupabaseAdmin();
    const { data: business } = await admin
      .from("businesses")
      .select("slug,name")
      .eq("id", input.businessId)
      .single();
    if (!business) return "none" as const;
    const text = message(
      input.kind,
      business.name as string,
      input.phone || "",
      input.minutes,
      input.who,
    );
    let channel: "whatsapp" | "email" | "none" = "none";
    const store = await getPublicStore(business.slug as string);
    const to = await ownerPhone(store);
    if (input.kind !== "disconnected") {
      const send = to ? await noticeSender(input.businessId, to) : null;
      if (to && send)
        channel = await send(to, text).then(
          () => "whatsapp" as const,
          () => "none" as const,
        );
    } else if (to) {
      // O WhatsApp da casa caiu: o aviso sai pelo número da StudioFlow, e o
      // e-mail vai junto (quem não olha o celular não perde).
      const { platformSend } = await import("../whatsapp/platform");
      if (await platformSend(to, text).catch(() => false)) channel = "whatsapp";
    }
    if (
      (channel === "none" || input.kind === "disconnected") &&
      (await emailConfigured())
    ) {
      const to = await ownerEmail(input.businessId);
      if (to)
        channel = await sendEmail(
          brandEmail({
            to,
            subject:
              input.kind === "disconnected"
                ? `O WhatsApp da ${business.name} desconectou`
                : `A recepcionista da ${business.name} precisa de você`,
            preview: text.slice(0, 120),
            title:
              input.kind === "disconnected"
                ? "WhatsApp desconectado"
                : "Um cliente precisa de resposta",
            paragraphs: [text.replace(/^\S+ StudioFlow: /, "")],
            cta:
              input.kind === "disconnected"
                ? {
                    label: "Reconectar",
                    url: `${appUrl}/dashboard/configuracoes?aba=whatsapp`,
                  }
                : { label: "Abrir conversas", url: panel },
          }),
          `assistant-alert-${id}`,
        ).then(
          () => (channel === "whatsapp" ? channel : ("email" as const)),
          () => channel,
        );
    }
    await admin.from("assistant_alerts").update({ channel }).eq("id", id);
    return channel;
  } catch {
    return "none" as const;
  }
}

/**
 * Cron (every 5 minutes): customers waiting for an answer and shops whose
 * WhatsApp is disconnected while the receptionist is on.
 */
export async function checkAssistantHealth() {
  const report = {
    waiting: 0,
    disconnected: 0,
    reconnecting: 0,
    reconnected: 0,
    sent: 0,
  };
  if (isDemo()) return report;
  const admin = createSupabaseAdmin();
  // Cliente esperando só importa com a IA ligada; WhatsApp caído importa
  // sempre (lembretes e avisos também saem por ele).
  const aiOn = await platformAiEnabled();
  const { data: waiting, error } = aiOn
    ? await admin.rpc("assistant_waiting_customers")
    : { data: [], error: null };
  if (error) throw new Error("assistant health query failed");
  for (const row of (waiting || []) as {
    conversation_id: string;
    business_id: string;
    contact_phone: string;
    waiting_since: string;
  }[]) {
    report.waiting++;
    const sent = await alertOwner({
      businessId: row.business_id,
      kind: "no_reply",
      conversationId: row.conversation_id,
      phone: row.contact_phone,
      minutes: Math.max(
        2,
        Math.round((Date.now() - Date.parse(row.waiting_since)) / 60_000),
      ),
    });
    if (sent !== "none") report.sent++;
  }
  for (const table of ["whatsapp_links", "professional_whatsapp_links"] as const) {
    const { data: links } = await admin
      .from(table)
      .select(
        table === "whatsapp_links"
          ? "business_id,instance,status,updated_at,down_since,reconnect_tried_at"
          : "business_id,professional_id,instance,status,updated_at,down_since,reconnect_tried_at",
      )
      .neq("status", "open");
    for (const link of (links || []) as unknown as DownLink[]) {
      const step = linkRecovery(link);
      if (step.reconnect) {
        report.reconnecting++;
        if (await reconnectLink(table, link)) {
          report.reconnected++;
          continue;
        }
      }
      if (!step.alert) continue;
      report.disconnected++;
      const who = link.professional_id
        ? (
            await admin
              .from("professionals")
              .select("name")
              .eq("id", link.professional_id)
              .maybeSingle()
          ).data?.name
        : "";
      const sent = await alertOwner({
        businessId: link.business_id,
        kind: "disconnected",
        who: (who as string) || "",
      });
      if (sent !== "none") report.sent++;
    }
  }
  return report;
}

export interface DownLink {
  business_id: string;
  professional_id?: string | null;
  instance: string;
  status: string;
  updated_at: string;
  down_since: string | null;
  reconnect_tried_at: string | null;
}

/**
 * Número fora do ar: depois de 5 min a StudioFlow tenta reconectar sozinha
 * (no máximo a cada 30 min); depois de 10 min o dono é avisado.
 */
export function linkRecovery(link: DownLink, now = new Date()) {
  const since = Date.parse(link.down_since || link.updated_at);
  const down = now.getTime() - since;
  const tried = link.reconnect_tried_at
    ? now.getTime() - Date.parse(link.reconnect_tried_at)
    : Infinity;
  return {
    reconnect: down >= 5 * 60_000 && tried >= 30 * 60_000,
    alert: down >= 10 * 60_000,
  };
}

/**
 * Pede para a Evolution religar a sessão salva. Quando o celular ainda está
 * pareado, volta sem QR Code; quando não está, nada muda e o dono é avisado.
 */
async function reconnectLink(
  table: "whatsapp_links" | "professional_whatsapp_links",
  link: DownLink,
  wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  const admin = createSupabaseAdmin();
  let mark = admin
    .from(table)
    .update({ reconnect_tried_at: new Date().toISOString() })
    .eq("business_id", link.business_id);
  if (link.professional_id) mark = mark.eq("professional_id", link.professional_id);
  await mark;
  try {
    await connectInstance(link.instance);
    await wait(5_000);
    if ((await instanceState(link.instance)) !== "open") return false;
    await saveLinkState(link.business_id, "open", link.professional_id || undefined);
    return true;
  } catch {
    return false;
  }
}
