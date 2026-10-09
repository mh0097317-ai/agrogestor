import { createSupabaseAdmin } from "@/lib/supabase/server";
import { brazilPhone } from "../assistant/whatsapp";
import { findChats, findMessages, jidPhone, parseEvolution } from "./evolution";
import type { ConversationMessage, ConversationSummary } from "@/types";
import { isDemo } from "../server-demo";

/** Register successful API sends before their webhook echoes can reach the AI.
 * Includes reminders: an automatic reminder must never look like a person
 * taking over the conversation. No new conversation is created here. */
export async function recordOutgoing(
  instance: string,
  phone: string,
  body: string,
  id: string,
  role: "staff" | "assistant",
) {
  if (isDemo()) return;
  const admin = createSupabaseAdmin();
  const [shop, professional] = await Promise.all([
    admin
      .from("whatsapp_links")
      .select("business_id")
      .eq("instance", instance)
      .maybeSingle(),
    admin
      .from("professional_whatsapp_links")
      .select("business_id,professional_id")
      .eq("instance", instance)
      .maybeSingle(),
  ]);
  if (shop.error || professional.error)
    throw new Error("whatsapp-outgoing-link-failed");
  const link = professional.data || shop.data;
  if (!link) return; // Platform notifications are not a business customer chat.
  const professionalId = professional.data?.professional_id;
  let query = admin
    .from("conversations")
    .select("id,tenant_id")
    .eq("business_id", link.business_id)
    .eq("channel", "whatsapp")
    .eq("contact_phone", brazilPhone(phone));
  query = professionalId
    ? query.eq("whatsapp_professional_id", professionalId)
    : query.is("whatsapp_professional_id", null);
  const { data: conversation, error } = await query.maybeSingle();
  if (error) throw new Error("whatsapp-outgoing-scope-failed");
  if (!conversation) return;
  const { error: insertError } = await admin
    .from("conversation_messages")
    .insert({
      tenant_id: conversation.tenant_id,
      business_id: link.business_id,
      conversation_id: conversation.id,
      role,
      body: body.slice(0, 4000),
      provider_message_id: professionalId ? `${professionalId}:${id}` : id,
    });
  if (insertError && insertError.code !== "23505")
    throw new Error("whatsapp-outgoing-save-failed");
}

const cache = new Map<
  string,
  { until: number; value: ReturnType<typeof findChats> }
>();
async function chats(instance: string) {
  const found = cache.get(instance);
  if (found && found.until > Date.now()) return found.value;
  const value = findChats(instance);
  cache.set(instance, { until: Date.now() + 15_000, value });
  try {
    return await value;
  } catch (error) {
    cache.delete(instance);
    throw error;
  }
}

/** Called only after the caller has authorized the conversation through RLS. */
export async function realWhatsAppChat(
  businessId: string,
  item: Pick<
    ConversationSummary,
    "channel" | "contactPhone" | "whatsappProfessionalId"
  >,
  providerIds: string[],
) {
  if (item.channel !== "whatsapp") return undefined;
  const professionalId = item.whatsappProfessionalId;
  let query = createSupabaseAdmin()
    .from(professionalId ? "professional_whatsapp_links" : "whatsapp_links")
    .select("instance,status")
    .eq("business_id", businessId);
  if (professionalId) query = query.eq("professional_id", professionalId);
  const { data: link, error } = await query.maybeSingle();
  if (error) throw new Error("whatsapp-history-link-unavailable");
  if (!link || link.status !== "open") return undefined;
  const snapshot = await chats(link.instance);
  const samePhone = (jid: unknown) => {
    const phone = jidPhone(jid);
    return (
      !!phone &&
      brazilPhone(phone) ===
        brazilPhone(
          item.contactPhone.length <= 11
            ? `55${item.contactPhone}`
            : item.contactPhone,
        )
    );
  };
  let chat = snapshot.find((chat) =>
    [
      chat.remoteJid,
      chat.lastMessage?.key?.remoteJidAlt,
      chat.lastMessage?.key?.senderPn,
    ].some(samePhone),
  );
  // LID identities must be resolved by a real message ID, never a display name.
  if (!chat) {
    for (const id of providerIds.slice(0, 2)) {
      const records = await findMessages(
        link.instance,
        { id: id.split(":").at(-1) },
        5,
      );
      const record = records.find(
        (record) =>
          (record as { key?: { id?: string } }).key?.id ===
          id.split(":").at(-1),
      ) as { key?: { remoteJid?: string } } | undefined;
      chat = snapshot.find(
        (chat) =>
          record?.key?.remoteJid && chat.remoteJid === record.key.remoteJid,
      );
      if (chat) break;
    }
  }
  return chat?.remoteJid
    ? {
        instance: link.instance as string,
        jid: chat.remoteJid,
        lastMessage: chat.lastMessage,
      }
    : null;
}

/** Provider records are the visible transcript; internal notes stay in activity. */
export function mirrorMessages(
  records: unknown[],
  stored: (ConversationMessage & { providerMessageId?: string })[],
  instance: string,
  phone = "",
) {
  const seen = new Set<string>();
  return records
    .flatMap((record): ConversationMessage[] => {
      const raw = record as {
        key?: { id?: string; remoteJid?: string; remoteJidAlt?: string };
        MessageUpdate?: { status?: string }[];
      };
      if (raw.MessageUpdate?.some((update) => update.status === "DELETED"))
        return [];
      const incoming = parseEvolution(
        {
          instance,
          event: "MESSAGES_UPSERT",
          data: {
            ...raw,
            key: {
              ...raw.key,
              ...(!jidPhone(raw.key?.remoteJid) &&
              !jidPhone(raw.key?.remoteJidAlt) &&
              phone
                ? { remoteJidAlt: `${phone}@s.whatsapp.net` }
                : {}),
            },
          },
        },
        true,
      ).messages[0];
      if (!incoming || seen.has(incoming.id)) return [];
      seen.add(incoming.id);
      const matched =
        stored.find(
          (message) =>
            message.providerMessageId?.split(":").at(-1) === incoming.id,
        ) ||
        (incoming.fromMe
          ? stored.find(
              (message) =>
                message.role !== "customer" &&
                message.role !== "event" &&
                message.body === incoming.text &&
                incoming.createdAt &&
                Math.abs(
                  Date.parse(message.createdAt) -
                    Date.parse(incoming.createdAt),
                ) < 120_000,
            )
          : undefined);
      return [
        {
          id: matched?.id || `wa:${incoming.id}`,
          role: incoming.fromMe
            ? matched?.role === "assistant"
              ? "assistant"
              : "staff"
            : "customer",
          body:
            (incoming.audioId && matched ? matched.body : incoming.text) ||
            "[Áudio recebido no WhatsApp.]",
          createdAt:
            incoming.createdAt ||
            matched?.createdAt ||
            new Date(0).toISOString(),
        },
      ];
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function realWhatsAppMessages(
  chat: { instance: string; jid: string },
  stored: (ConversationMessage & { providerMessageId?: string })[],
  phone = "",
) {
  return mirrorMessages(
    await findMessages(chat.instance, { remoteJid: chat.jid }),
    stored,
    chat.instance,
    phone,
  );
}
