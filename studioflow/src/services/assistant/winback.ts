import { hasModule } from "@/lib/modules";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Store } from "@/types";
import { isDemo } from "../server-demo";
import { getPublicStore } from "../server-store";
import { platformAiEnabled } from "../platform-ai-control";
import { conversationSender } from "../whatsapp/link";

/*
 * Chamar de volta quem sumiu. Desligado por padrão: o dono liga na
 * Recepcionista. Uma mensagem por cliente a cada 60 dias, no máximo 15 por
 * loja por dia, às 10h de Brasília em dia de funcionamento. A resposta do
 * cliente cai na recepcionista, que já vê a mensagem na conversa. Quem
 * responde PARAR não recebe mais (Política de Privacidade).
 */

const dailyLimit = 15;
const repeatDays = 60;
const digits = (value: string) =>
  value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
const firstName = (name: string) => {
  const first = name.trim().split(/\s+/)[0] || "";
  return first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : "";
};
const lower = (value: string) => value.toLowerCase();

/** 10h–11h in Brasília (UTC-3, no daylight saving). */
export const winbackWindow = (now = new Date()) => now.getUTCHours() === 13;

/** A customer asking to stop these messages. */
export const asksToStop = (text: string) =>
  /^\s*(parar|pare|para|sair|stop|chega)\s*[.!]*\s*$/i.test(text) ||
  /^\s*(n[aã]o|nao) (quero (mais )?(receber|mensage(m|ns))|(me )?mand[ae] mais)\b[^?]{0,40}$/i.test(
    text,
  );

/** Customers due for a come-back message, most recently lapsed first. */
export function winbackCandidates(
  store: Store,
  now: Date,
  days: number,
  skip: Set<string>,
) {
  const byPhone = new Map<
    string,
    { name: string; phone: string; last: Store["appointments"][number] }
  >();
  const upcoming = new Set<string>();
  for (const a of store.appointments) {
    const phone = digits(a.customerPhone || "");
    if (!/^\d{10,11}$/.test(phone)) continue;
    if (
      ["confirmed", "pending"].includes(a.status) &&
      Date.parse(a.start) > now.getTime()
    )
      upcoming.add(phone);
    if (a.status !== "completed") continue;
    const seen = byPhone.get(phone);
    if (!seen || a.start > seen.last.start)
      byPhone.set(phone, { name: a.customerName, phone, last: a });
  }
  const from = now.getTime() - (days + 60) * 86_400_000;
  const to = now.getTime() - days * 86_400_000;
  return [...byPhone.values()]
    .filter(
      (c) =>
        !upcoming.has(c.phone) &&
        !skip.has(c.phone) &&
        Date.parse(c.last.start) >= from &&
        Date.parse(c.last.start) <= to,
    )
    .sort((a, b) => b.last.start.localeCompare(a.last.start));
}

export function winbackText(
  store: Store,
  customer: { name: string; last: Store["appointments"][number] },
) {
  const name = firstName(customer.name);
  const service = store.services.find(
    (s) => s.active && s.id === customer.last.serviceIds[0],
  );
  const person = store.professionals.find(
    (p) => p.active && p.id === customer.last.professionalId,
  );
  const what = service
    ? `o seu ${lower(service.name)}${person ? ` com ${firstName(person.name)}` : ""}`
    : "o seu horário";
  return `Oi${name ? `, ${name}` : ""}! Aqui é da ${store.business.name} 💈 Faz um tempinho que você não aparece por aqui. Quer que eu veja ${what} essa semana?\n\nSe preferir não receber esse tipo de mensagem, é só responder PARAR.`;
}

/**
 * Records the opt-out when the customer answers PARAR to a come-back
 * message and returns the reply; null when it is not that.
 */
export async function winbackStop(
  businessId: string,
  phone: string,
  text: string,
) {
  if (isDemo() || !asksToStop(text)) return null;
  const admin = createSupabaseAdmin();
  const own = digits(phone);
  const { count } = await admin
    .from("customer_winbacks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("phone", own)
    .eq("kind", "sent")
    .gte("created_at", new Date(Date.now() - 14 * 86_400_000).toISOString());
  if (!count) return null;
  await admin
    .from("customer_winbacks")
    .insert({ business_id: businessId, phone: own, kind: "optout" });
  return "Pronto, não te mando mais esse tipo de mensagem. Quando quiser marcar, é só chamar aqui 👍";
}

/** Cron: today's come-back messages, shop by shop. Never throws per shop. */
export async function sendWinbacks(now = new Date()) {
  const report = { shops: 0, sent: 0, failed: 0 };
  if (isDemo() || !winbackWindow(now) || !(await platformAiEnabled()))
    return report;
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("business_settings")
    .select("business_id,winback_days,businesses!inner(slug)")
    .eq("winback_enabled", true)
    .eq("assistant_enabled", true);
  for (const row of (data || []) as unknown as {
    business_id: string;
    winback_days: number;
    businesses: { slug: string };
  }[]) {
    try {
      const store = await getPublicStore(row.businesses.slug);
      const weekday = new Date(now.getTime() - 3 * 3_600_000).getUTCDay();
      if (
        !hasModule(store.access?.modules, "recepcionista") ||
        !store.settings.openDays.includes(weekday)
      )
        continue;
      const send = await conversationSender(row.business_id, null, "assistant");
      if (!send) continue;
      const { data: history } = await admin
        .from("customer_winbacks")
        .select("phone,kind,created_at")
        .eq("business_id", row.business_id)
        .gte(
          "created_at",
          new Date(now.getTime() - 400 * 86_400_000).toISOString(),
        );
      const recent = now.getTime() - repeatDays * 86_400_000;
      const today = now.getTime() - 20 * 3_600_000;
      const skip = new Set(
        (history || [])
          .filter(
            (h) => h.kind === "optout" || Date.parse(h.created_at) >= recent,
          )
          .map((h) => h.phone as string),
      );
      const sentToday = (history || []).filter(
        (h) => h.kind === "sent" && Date.parse(h.created_at) >= today,
      ).length;
      const due = winbackCandidates(
        store,
        now,
        row.winback_days || 35,
        skip,
      ).slice(0, Math.max(0, dailyLimit - sentToday));
      if (!due.length) continue;
      report.shops++;
      for (const customer of due) {
        // Claimed first, so a slow tick never sends twice.
        const { data: claim, error } = await admin
          .from("customer_winbacks")
          .insert({
            business_id: row.business_id,
            phone: customer.phone,
            kind: "sent",
          })
          .select("id")
          .single();
        if (error) continue;
        try {
          await send(customer.phone, winbackText(store, customer));
          report.sent++;
        } catch {
          await admin.from("customer_winbacks").delete().eq("id", claim.id);
          report.failed++;
        }
      }
    } catch {
      report.failed++;
    }
  }
  return report;
}
