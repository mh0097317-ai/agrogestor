import { appUrl } from "@/lib/app-url";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isDemo } from "../server-demo";
import { getPublicStore } from "../server-store";
import { ownerPhone } from "../attendance";
import { shopSender } from "../whatsapp/link";
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
  let same = admin
    .from("assistant_alerts")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("kind", kind)
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

function message(kind: AlertKind, shop: string, phone: string, minutes = 0) {
  if (kind === "failed")
    return `⚠️ StudioFlow: a recepcionista da ${shop} não conseguiu responder o cliente de final ${tail(phone)}. A conversa passou para a equipe, responda por aqui: ${panel}`;
  if (kind === "no_reply")
    return `⏱️ StudioFlow: o cliente de final ${tail(phone)} está esperando resposta há ${minutes} min na ${shop}. Dá uma olhada: ${panel}`;
  return `⚠️ StudioFlow: o WhatsApp da ${shop} desconectou e a recepcionista não está recebendo mensagens. Reconecte lendo o QR Code em Configurações → WhatsApp: ${appUrl}/dashboard/configuracoes`;
}

/** Tells the owner, once, by WhatsApp and otherwise by e-mail. Never throws. */
export async function alertOwner(input: {
  businessId: string;
  kind: AlertKind;
  conversationId?: string | null;
  phone?: string;
  minutes?: number;
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
    );
    let channel: "whatsapp" | "email" | "none" = "none";
    if (input.kind !== "disconnected") {
      const store = await getPublicStore(business.slug as string);
      const [to, send] = await Promise.all([
        ownerPhone(store),
        shopSender(input.businessId),
      ]);
      if (to && send)
        channel = await send(to, text).then(
          () => "whatsapp" as const,
          () => "none" as const,
        );
    }
    if (channel === "none" && (await emailConfigured())) {
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
                    url: `${appUrl}/dashboard/configuracoes`,
                  }
                : { label: "Abrir conversas", url: panel },
          }),
          `assistant-alert-${id}`,
        ).then(
          () => "email" as const,
          () => "none" as const,
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
  const report = { waiting: 0, disconnected: 0, sent: 0 };
  if (isDemo() || !(await platformAiEnabled())) return report;
  const admin = createSupabaseAdmin();
  const { data: waiting, error } = await admin.rpc(
    "assistant_waiting_customers",
  );
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
  const { data: links } = await admin
    .from("whatsapp_links")
    .select("business_id,status,updated_at")
    .neq("status", "open");
  for (const link of links || []) {
    const { data: settings } = await admin
      .from("business_settings")
      .select("assistant_enabled")
      .eq("business_id", link.business_id)
      .maybeSingle();
    // A link that was just being reconnected gets a few minutes first.
    if (
      !settings?.assistant_enabled ||
      Date.now() - Date.parse(link.updated_at as string) < 10 * 60_000
    )
      continue;
    report.disconnected++;
    const sent = await alertOwner({
      businessId: link.business_id as string,
      kind: "disconnected",
    });
    if (sent !== "none") report.sent++;
  }
  return report;
}
