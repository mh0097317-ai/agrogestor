import { randomBytes } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin, requireMembership } from "@/lib/supabase/server";
import type { ConversationMessage, ConversationSummary } from "@/types";
import { isDemo, mutateDemo, readDemo } from "../server-demo";
import { encryptSecret, sha256 } from "../server-secrets";
import { camel, demoWorkspaceSlug } from "../server-store";
import { demoRepo, liveRepo, whatsappAccount } from "./conversations";
import { checkWhatsApp, sendWhatsApp } from "./whatsapp";

const editors = ["owner", "admin", "manager"];
const staff = [...editors, "receptionist"];

export const assistantSchema = z.object({
  assistantEnabled: z.boolean(),
  assistantName: z.string().trim().min(2, "Dê um nome à atendente.").max(40),
  assistantInstructions: z.string().trim().max(1500, "Use no máximo 1.500 caracteres."),
  assistantDailyLimit: z.number().int().min(10).max(5000),
});
export const whatsappSchema = z.object({
  phoneNumberId: z.string().trim().regex(/^\d{5,30}$/, "O ID do número tem só dígitos."),
  token: z.string().trim().min(20, "Cole o token de acesso completo.").max(1000),
  appSecret: z.string().trim().min(16, "Cole a chave secreta do app.").max(200),
});
export const conversationActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reply"),
    body: z.string().trim().min(1, "Escreva a mensagem.").max(2000),
  }),
  z.object({
    action: z.literal("status"),
    status: z.enum(["ai", "human", "closed"]),
  }),
]);

async function member(roles?: string[]) {
  const membership = await requireMembership();
  if (roles && !roles.includes(membership.role))
    throw new DomainError("Seu perfil não pode fazer isso.", 403);
  return membership;
}

export async function updateAssistant(input: z.infer<typeof assistantSchema>) {
  if (isDemo())
    return mutateDemo(
      (store) => {
        Object.assign(store.settings, input);
        return input;
      },
      await demoWorkspaceSlug(),
    );
  const { client, businessId } = await member(editors);
  const { error } = await client
    .from("business_settings")
    .update({
      assistant_enabled: input.assistantEnabled,
      assistant_name: input.assistantName,
      assistant_instructions: input.assistantInstructions,
      assistant_daily_limit: input.assistantDailyLimit,
    })
    .eq("business_id", businessId);
  if (error) throw new DomainError("Não foi possível salvar a atendente.", 503);
  return input;
}

export async function connectWhatsApp(
  input: z.infer<typeof whatsappSchema>,
  origin: string,
) {
  if (isDemo())
    throw new DomainError(
      "O WhatsApp oficial funciona só no ambiente de produção.",
      400,
    );
  const { businessId } = await member(editors);
  const displayPhone = await checkWhatsApp(input.phoneNumberId, input.token);
  const admin = createSupabaseAdmin();
  const { data: business } = await admin
    .from("businesses")
    .select("tenant_id")
    .eq("id", businessId)
    .single();
  const verifyToken = randomBytes(24).toString("base64url");
  const { error } = await admin.from("whatsapp_accounts").upsert({
    business_id: businessId,
    tenant_id: business!.tenant_id,
    phone_number_id: input.phoneNumberId,
    display_phone: displayPhone,
    access_token_enc: encryptSecret(input.token),
    app_secret_enc: encryptSecret(input.appSecret),
    verify_token_hash: `\\x${sha256(verifyToken).toString("hex")}`,
  });
  if (error?.code === "23505")
    throw new DomainError("Este número já está ligado a outro estabelecimento.", 409);
  if (error) throw new DomainError("Não foi possível salvar a conexão.", 503);
  // The verify token is shown once: Meta asks for it when the webhook is set.
  return {
    displayPhone,
    webhookUrl: `${origin}/api/whatsapp/${businessId}`,
    verifyToken,
  };
}

export async function disconnectWhatsApp() {
  if (isDemo()) return { ok: true };
  const { businessId } = await member(editors);
  await createSupabaseAdmin().from("whatsapp_accounts").delete().eq("business_id", businessId);
  return { ok: true };
}

export async function listConversations(): Promise<ConversationSummary[]> {
  if (isDemo()) {
    const store = await readDemo(await demoWorkspaceSlug());
    return (store.conversations || [])
      .filter((item) => item.messages.length)
      .map((item) => ({
        id: item.id,
        channel: item.channel,
        contactName: item.contactName,
        contactPhone: item.contactPhone,
        status: item.status,
        unread: item.unread,
        lastMessageAt: item.lastMessageAt,
        preview: item.messages.filter((m) => m.role !== "event").at(-1)?.body,
      }))
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }
  const { client, businessId } = await member();
  const { data, error } = await client
    .from("conversations")
    .select("id,channel,contact_name,contact_phone,status,unread,last_message_at")
    .eq("business_id", businessId)
    .order("last_message_at", { ascending: false })
    .limit(60);
  if (error) return [];
  const list = camel(data || []) as ConversationSummary[];
  if (!list.length) return list;
  const { data: last } = await client
    .from("conversation_messages")
    .select("conversation_id,body,role,created_at")
    .eq("business_id", businessId)
    .in(
      "conversation_id",
      list.map((item) => item.id),
    )
    .neq("role", "event")
    .order("created_at", { ascending: false })
    .limit(600);
  for (const item of list)
    item.preview = (last || []).find((row) => row.conversation_id === item.id)?.body;
  return list.filter((item) => item.preview);
}

export async function conversationDetail(id: string) {
  if (isDemo()) {
    const slug = await demoWorkspaceSlug();
    const store = await readDemo(slug);
    const repo = demoRepo(slug, store.business.id);
    const conversation = await repo.get(id);
    if (!conversation) throw new DomainError("Conversa não encontrada.", 404);
    await repo.update(id, { unread: 0 });
    return { conversation: { ...conversation, history: undefined }, messages: await repo.messages(id) };
  }
  const { client, businessId, role } = await member();
  const { data } = await client
    .from("conversations")
    .select("id,channel,contact_name,contact_phone,status,unread,last_message_at")
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new DomainError("Conversa não encontrada.", 404);
  const { data: messages } = await client
    .from("conversation_messages")
    .select("id,role,body,created_at")
    .eq("conversation_id", id)
    .order("created_at")
    .limit(500);
  if (staff.includes(role) && data.unread)
    await createSupabaseAdmin().from("conversations").update({ unread: 0 }).eq("id", id);
  return {
    conversation: camel(data) as ConversationSummary,
    messages: camel(messages || []) as ConversationMessage[],
  };
}

export async function conversationAction(
  id: string,
  input: z.infer<typeof conversationActionSchema>,
) {
  const demo = isDemo();
  let repo;
  let whatsapp: Awaited<ReturnType<typeof whatsappAccount>> = null;
  if (demo) {
    const slug = await demoWorkspaceSlug();
    const store = await readDemo(slug);
    repo = demoRepo(slug, store.business.id);
  } else {
    const { businessId } = await member(staff);
    const { data: business } = await createSupabaseAdmin()
      .from("businesses")
      .select("tenant_id")
      .eq("id", businessId)
      .single();
    repo = liveRepo(businessId, business!.tenant_id);
    whatsapp = await whatsappAccount(businessId);
  }
  const conversation = await repo.get(id);
  if (!conversation) throw new DomainError("Conversa não encontrada.", 404);
  if (input.action === "status") {
    await repo.update(id, { status: input.status, unread: 0 });
    await repo.addMessage(
      id,
      "event",
      input.status === "ai"
        ? "Conversa devolvida para a atendente virtual."
        : input.status === "human"
          ? "A equipe assumiu a conversa."
          : "Conversa encerrada.",
    );
    return { ok: true };
  }
  if (conversation.channel === "whatsapp") {
    if (!whatsapp) throw new DomainError("Conecte o WhatsApp para responder por ele.", 409);
    await sendWhatsApp({
      phoneNumberId: whatsapp.phoneNumberId,
      token: whatsapp.token,
      to: `55${conversation.contactPhone}`,
      body: input.body,
    });
  }
  await repo.addMessage(id, "staff", input.body);
  // Whoever answers takes the conversation; the AI waits until it is handed back.
  if (conversation.status !== "human") await repo.update(id, { status: "human", unread: 0 });
  return { ok: true };
}
