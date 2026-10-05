import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin, readBusinessAccess } from "@/lib/supabase/server";
import type {
  ConversationChannel,
  ConversationMessage,
  ConversationStatus,
  DemoConversation,
  Store,
} from "@/types";
import { isDemo, mutateDemo, readDemo } from "../server-demo";
import { bookWithPayments, getPaymentAccount } from "../server-payments";
import { decryptSecret, newToken, sha256 } from "../server-secrets";
import { camel, getPublicStore } from "../server-store";
import { accessOpen } from "@/lib/access";
import { hasModule } from "@/lib/modules";
import { claudeCreate, runAssistant, type CreateMessage } from "./agent";
import { sendWhatsApp } from "./whatsapp";
import { sendInstagram, type InstagramMessage } from "./instagram";
import { audioText, downloadUrl, downloadWhatsAppMedia } from "./transcribe";

type History = Anthropic.Beta.BetaMessageParam[];
export interface Conversation {
  id: string;
  channel: ConversationChannel;
  contactPhone: string;
  contactName: string;
  /** Instagram: id de quem escreveu. */
  contactRef?: string;
  status: ConversationStatus;
  unread: number;
  history: History;
  aiCursor: string;
}
type Role = ConversationMessage["role"];

/** Storage behind conversations: Supabase in production, files in the demo. */
export interface ConversationRepo {
  businessId: string;
  byToken(tokenHash: string): Promise<Conversation | null>;
  byPhone(channel: ConversationChannel, phone: string): Promise<Conversation | null>;
  /** Instagram: a conversa de quem escreveu. */
  byRef(channel: ConversationChannel, ref: string): Promise<Conversation | null>;
  get(id: string): Promise<Conversation | null>;
  create(input: {
    channel: ConversationChannel;
    contactPhone: string;
    contactName: string;
    contactRef?: string;
    tokenHash?: string;
  }): Promise<Conversation>;
  /** False when this provider message was already stored. */
  addMessage(id: string, role: Role, body: string, providerId?: string): Promise<boolean>;
  messages(id: string, since?: string): Promise<ConversationMessage[]>;
  lease(id: string): Promise<boolean>;
  release(id: string): Promise<void>;
  update(
    id: string,
    patch: Partial<Pick<Conversation, "history" | "aiCursor" | "status" | "contactName" | "contactPhone">> & {
      unreadDelta?: number;
      unread?: number;
    },
  ): Promise<void>;
  takeTurn(): Promise<boolean>;
  addTokens(input: number, output: number): Promise<void>;
}

const hex = (token: string) => sha256(token).toString("hex");
const toBytea = (value: string) => `\\x${value}`;

export function liveRepo(businessId: string, tenantId: string): ConversationRepo {
  const admin = createSupabaseAdmin();
  const columns =
    "id,channel,contact_phone,contact_name,contact_ref,status,unread,history,ai_cursor";
  const one = async (query: PromiseLike<{ data: unknown }>) => {
    const { data } = await query;
    return data ? (camel(data) as Conversation) : null;
  };
  return {
    businessId,
    byToken: (tokenHash) =>
      one(
        admin
          .from("conversations")
          .select(columns)
          .eq("business_id", businessId)
          .eq("token_hash", toBytea(tokenHash))
          .maybeSingle(),
      ),
    byPhone: (channel, phone) =>
      one(
        admin
          .from("conversations")
          .select(columns)
          .eq("business_id", businessId)
          .eq("channel", channel)
          .eq("contact_phone", phone)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ),
    byRef: (channel, ref) =>
      one(
        admin
          .from("conversations")
          .select(columns)
          .eq("business_id", businessId)
          .eq("channel", channel)
          .eq("contact_ref", ref)
          .limit(1)
          .maybeSingle(),
      ),
    get: (id) =>
      one(
        admin
          .from("conversations")
          .select(columns)
          .eq("business_id", businessId)
          .eq("id", id)
          .maybeSingle(),
      ),
    async create(input) {
      const { data, error } = await admin
        .from("conversations")
        .insert({
          tenant_id: tenantId,
          business_id: businessId,
          channel: input.channel,
          contact_phone: input.contactPhone,
          contact_name: input.contactName.slice(0, 100),
          contact_ref: input.contactRef || "",
          token_hash: input.tokenHash ? toBytea(input.tokenHash) : null,
        })
        .select(columns)
        .single();
      if (error?.code === "23505" && input.channel === "whatsapp") {
        const existing = await this.byPhone("whatsapp", input.contactPhone);
        if (existing) return existing;
      }
      if (error?.code === "23505" && input.channel === "instagram" && input.contactRef) {
        const existing = await this.byRef("instagram", input.contactRef);
        if (existing) return existing;
      }
      if (error || !data) throw new DomainError("Não foi possível abrir a conversa.", 503);
      return camel(data) as Conversation;
    },
    async addMessage(id, role, body, providerId) {
      const { error } = await admin.from("conversation_messages").insert({
        tenant_id: tenantId,
        business_id: businessId,
        conversation_id: id,
        role,
        body: body.slice(0, 4000),
        provider_message_id: providerId || null,
      });
      if (error?.code === "23505") return false;
      if (error) throw new DomainError("Não foi possível guardar a mensagem.", 503);
      await admin
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", id);
      return true;
    },
    async messages(id, since) {
      let query = admin
        .from("conversation_messages")
        .select("id,role,body,created_at")
        .eq("business_id", businessId)
        .eq("conversation_id", id)
        .order("created_at")
        .limit(500);
      if (since) query = query.gt("created_at", since);
      const { data } = await query;
      return (camel(data || []) as ConversationMessage[]);
    },
    async lease(id) {
      const { data } = await admin.rpc("conversation_lease", {
        p_conversation_id: id,
      });
      return data === true;
    },
    async release(id) {
      await admin.from("conversations").update({ processing_until: null }).eq("id", id);
    },
    async update(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.history) row.history = patch.history;
      if (patch.aiCursor) row.ai_cursor = patch.aiCursor;
      if (patch.status) row.status = patch.status;
      if (patch.contactName !== undefined) row.contact_name = patch.contactName.slice(0, 100);
      if (patch.contactPhone !== undefined) row.contact_phone = patch.contactPhone;
      if (patch.unread !== undefined) row.unread = patch.unread;
      if (patch.unreadDelta) {
        const { data } = await admin
          .from("conversations")
          .select("unread")
          .eq("id", id)
          .single();
        row.unread = Math.max(0, (data?.unread || 0) + patch.unreadDelta);
      }
      if (Object.keys(row).length)
        await admin.from("conversations").update(row).eq("business_id", businessId).eq("id", id);
    },
    async takeTurn() {
      const { data } = await admin.rpc("assistant_take_turn", {
        p_business_id: businessId,
      });
      return data === true;
    },
    async addTokens(input, output) {
      await admin.rpc("assistant_add_tokens", {
        p_business_id: businessId,
        p_input: input,
        p_output: output,
      });
    },
  };
}

/** Same contract on the demo files (no real concurrency in the demo). */
export function demoRepo(slug: string, businessId: string): ConversationRepo {
  const pick = (store: Store, id: string) =>
    store.conversations?.find((item) => item.id === id);
  const view = (item?: DemoConversation): Conversation | null =>
    item
      ? {
          id: item.id,
          channel: item.channel,
          contactPhone: item.contactPhone,
          contactName: item.contactName,
          contactRef: item.contactRef,
          status: item.status,
          unread: item.unread,
          history: item.history as History,
          aiCursor: item.aiCursor,
        }
      : null;
  const read = async <T,>(fn: (store: Store) => T) => fn(await readDemo(slug));
  return {
    businessId,
    byToken: (tokenHash) =>
      read((store) => view(store.conversations?.find((item) => item.tokenHash === tokenHash))),
    byPhone: (channel, phone) =>
      read((store) =>
        view(
          store.conversations?.find(
            (item) => item.channel === channel && item.contactPhone === phone,
          ),
        ),
      ),
    byRef: (channel, ref) =>
      read((store) =>
        view(
          store.conversations?.find(
            (item) => item.channel === channel && item.contactRef === ref,
          ),
        ),
      ),
    get: (id) => read((store) => view(pick(store, id))),
    create: (input) =>
      mutateDemo((store) => {
        const now = new Date().toISOString();
        // A message stored in the same millisecond still counts as new.
        const before = new Date(Date.now() - 1).toISOString();
        const item: DemoConversation = {
          id: randomUUID(),
          channel: input.channel,
          contactPhone: input.contactPhone,
          contactName: input.contactName,
          contactRef: input.contactRef,
          status: "ai",
          unread: 0,
          lastMessageAt: now,
          tokenHash: input.tokenHash,
          history: [],
          aiCursor: before,
          messages: [],
        };
        (store.conversations ??= []).unshift(item);
        return view(item)!;
      }, slug),
    addMessage: (id, role, body) =>
      mutateDemo((store) => {
        const item = pick(store, id);
        if (!item) return false;
        const createdAt = new Date().toISOString();
        item.messages.push({ id: randomUUID(), role, body: body.slice(0, 4000), createdAt });
        item.lastMessageAt = createdAt;
        return true;
      }, slug),
    messages: (id, since) =>
      read((store) =>
        (pick(store, id)?.messages || []).filter(
          (message) => !since || message.createdAt > since,
        ),
      ),
    lease: async () => true,
    release: async () => undefined,
    update: (id, patch) =>
      mutateDemo((store) => {
        const item = pick(store, id);
        if (!item) return;
        if (patch.history) item.history = patch.history;
        if (patch.aiCursor) item.aiCursor = patch.aiCursor;
        if (patch.status) item.status = patch.status;
        if (patch.contactName !== undefined) item.contactName = patch.contactName;
        if (patch.contactPhone !== undefined) item.contactPhone = patch.contactPhone;
        if (patch.unread !== undefined) item.unread = patch.unread;
        if (patch.unreadDelta) item.unread = Math.max(0, item.unread + patch.unreadDelta);
      }, slug),
    takeTurn: async () => true,
    addTokens: async () => undefined,
  };
}

export interface Delivery {
  /** Sends the assistant's answer out (WhatsApp); the web chat polls. */
  send?: (body: string) => Promise<void>;
  origin: string;
  slug: string;
}

const handoffNotice =
  "Chamei alguém da equipe para continuar com você. Em breve respondem por aqui.";

/**
 * Answers every customer message not yet handled, one answer at a time per
 * conversation. Messages that arrive meanwhile are picked up next round.
 */
export async function processConversation(
  repo: ConversationRepo,
  conversationId: string,
  delivery: Delivery,
  create: CreateMessage | null = claudeCreate(),
) {
  for (let round = 0; round < 3; round++) {
    if (!(await repo.lease(conversationId))) return;
    let say: string | null = null;
    try {
      say = await answerPending(repo, conversationId, delivery, create);
    } catch (error) {
      console.error(
        "StudioFlow assistant error:",
        error instanceof Error ? error.message : "unknown",
      );
      await repo
        .update(conversationId, { status: "human", unreadDelta: 1 })
        .catch(() => undefined);
      await repo
        .addMessage(
          conversationId,
          "event",
          "A atendente virtual teve um problema e passou a conversa para a equipe.",
        )
        .catch(() => undefined);
      say = handoffNotice;
      await repo.addMessage(conversationId, "assistant", say).catch(() => undefined);
    } finally {
      await repo.release(conversationId);
    }
    if (say === null) return;
    if (delivery.send) await delivery.send(say).catch(() => undefined);
  }
}

/** One answer for the pending messages; null when there is nothing to do. */
async function answerPending(
  repo: ConversationRepo,
  conversationId: string,
  delivery: Delivery,
  create: CreateMessage | null,
): Promise<string | null> {
  const conversation = await repo.get(conversationId);
  if (!conversation || conversation.status !== "ai") return null;
  const pending = (await repo.messages(conversationId, conversation.aiCursor)).filter(
    (message) => message.role === "customer" || message.role === "staff",
  );
  if (!pending.some((message) => message.role === "customer")) return null;
  const cursor = pending.at(-1)!.createdAt;
  const text =
    pending.length === 1
      ? pending[0].body
      : pending
          .slice(-20)
          .map((message) => `${message.role === "staff" ? "Equipe" : "Cliente"}: ${message.body}`)
          .join("\n");
  const toHuman = async (reason: string) => {
    await repo.update(conversationId, { aiCursor: cursor, status: "human", unreadDelta: 1 });
    await repo.addMessage(conversationId, "assistant", handoffNotice);
    await repo.addMessage(conversationId, "event", reason);
    return handoffNotice;
  };
  if (!create) return toHuman("Atendente virtual sem chave de IA configurada no servidor.");
  if (conversation.history.length > 160)
    return toHuman("Conversa longa: a atendente virtual passou para a equipe.");
  if (!(await repo.takeTurn())) return toHuman("Limite diário da atendente virtual atingido.");
  const store = await loadStore(delivery.slug);
  const payments = isDemo()
    ? !!store.paymentAccount
    : !!(await getPaymentAccount(store.business.id));
  const result = await runAssistant({
    create,
    store,
    history: conversation.history,
    customerText: text,
    ctx: {
      channel: conversation.channel,
      verifiedPhone: conversation.channel === "whatsapp" ? conversation.contactPhone : undefined,
      origin: delivery.origin,
      payments,
      loadStore: () => loadStore(delivery.slug),
      book: (input) =>
        bookWithPayments(delivery.slug, {
          serviceIds: input.serviceIds,
          professionalId: input.professionalId,
          start: input.start,
          name: input.name,
          phone: input.phone,
          email: "",
          reminder: true,
          cpf: input.cpf,
        }),
    },
  });
  await repo.update(conversationId, {
    history: result.history,
    aiCursor: cursor,
    ...(result.handoff ? { status: "human" as const, unreadDelta: 1 } : {}),
    ...(result.booked && !conversation.contactName
      ? { contactName: result.booked.customerName || "" }
      : {}),
    ...(result.booked && conversation.channel !== "whatsapp"
      ? { contactPhone: result.booked.customerPhone || "" }
      : {}),
  });
  await repo.addMessage(conversationId, "assistant", result.reply);
  if (result.booked)
    await repo.addMessage(conversationId, "event", "Horário marcado pela atendente virtual.");
  if (result.handoff)
    await repo.addMessage(conversationId, "event", `Pediu a equipe: ${result.handoff}`);
  await repo.addTokens(result.usage.input, result.usage.output);
  return result.reply;
}

// Também confere se a agenda online do estabelecimento está liberada.
const loadStore = (slug: string) => getPublicStore(slug);

/* ------------------------------------------------------------------ */
/* Web chat (public page)                                              */
/* ------------------------------------------------------------------ */

export interface ChatView {
  token: string;
  status: ConversationStatus;
  messages: ConversationMessage[];
  assistantName: string;
}

async function businessRepo(slug: string) {
  const store = await loadStore(slug);
  if (!store.settings.assistantEnabled)
    throw new DomainError("O atendimento por chat não está disponível agora.", 404);
  const repo = isDemo()
    ? demoRepo(slug, store.business.id)
    : liveRepo(store.business.id, store.business.tenantId);
  return { store, repo };
}

const visible = (messages: ConversationMessage[]) =>
  messages.filter((message) => message.role !== "event");

export async function webChat(
  slug: string,
  input: { token?: string; message: string },
  origin: string,
): Promise<ChatView> {
  const { store, repo } = await businessRepo(slug);
  let token = input.token || "";
  let conversation = token ? await repo.byToken(hex(token)) : null;
  if (!conversation) {
    token = newToken();
    conversation = await repo.create({
      channel: "web",
      contactPhone: "",
      contactName: "",
      tokenHash: hex(token),
    });
  }
  const sent = (await repo.messages(conversation.id)).filter(
    (message) => message.role === "customer",
  ).length;
  if (sent >= 60)
    throw new DomainError("Esta conversa ficou longa. Fale com o estabelecimento pelo WhatsApp.", 429);
  await repo.addMessage(conversation.id, "customer", input.message);
  if (conversation.status !== "ai")
    await repo.update(conversation.id, { unreadDelta: 1, ...(conversation.status === "closed" ? { status: "human" as const } : {}) });
  else await processConversation(repo, conversation.id, { origin, slug });
  const fresh = await repo.get(conversation.id);
  return {
    token,
    status: fresh?.status || "ai",
    messages: visible(await repo.messages(conversation.id)),
    assistantName: store.settings.assistantName,
  };
}

export async function webChatView(slug: string, token: string): Promise<ChatView> {
  const { store, repo } = await businessRepo(slug);
  const conversation = await repo.byToken(hex(token));
  if (!conversation) throw new DomainError("Conversa não encontrada.", 404);
  return {
    token,
    status: conversation.status,
    messages: visible(await repo.messages(conversation.id)),
    assistantName: store.settings.assistantName,
  };
}

/* ------------------------------------------------------------------ */
/* WhatsApp                                                            */
/* ------------------------------------------------------------------ */

export interface WhatsAppAccount {
  businessId: string;
  tenantId: string;
  phoneNumberId: string;
  token: string;
  appSecret: string;
  verifyTokenHash: Buffer;
}

export async function whatsappAccount(businessId: string): Promise<WhatsAppAccount | null> {
  const { data } = await createSupabaseAdmin()
    .from("whatsapp_accounts")
    .select("business_id,tenant_id,phone_number_id,access_token_enc,app_secret_enc,verify_token_hash")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data) return null;
  return {
    businessId: data.business_id,
    tenantId: data.tenant_id,
    phoneNumberId: data.phone_number_id,
    token: decryptSecret(data.access_token_enc),
    appSecret: decryptSecret(data.app_secret_enc),
    verifyTokenHash: Buffer.from(String(data.verify_token_hash).replace(/^\\x/, ""), "hex"),
  };
}

export async function slugOf(businessId: string) {
  const { data } = await createSupabaseAdmin()
    .from("businesses")
    .select("slug")
    .eq("id", businessId)
    .maybeSingle();
  if (!data) throw new DomainError("Não encontrado.", 404);
  return data.slug as string;
}

/**
 * A delivery from Meta for one business, already authenticated by the
 * signature. Stores each message once; the AI answers when it is on.
 * Returns the work to run after the 200 goes back to Meta.
 */
export async function receiveWhatsApp(
  account: WhatsAppAccount,
  messages: import("./whatsapp").InboundMessage[],
  origin: string,
) {
  const slug = await slugOf(account.businessId);
  // Sem acesso liberado ou sem a recepcionista no plano: a mensagem não é tratada.
  const access = await readBusinessAccess(account.businessId);
  if (!accessOpen(access) || !hasModule(access.modules, "recepcionista"))
    return async () => {};
  const repo = liveRepo(account.businessId, account.tenantId);
  const { data: settings } = await createSupabaseAdmin()
    .from("business_settings")
    .select("assistant_enabled")
    .eq("business_id", account.businessId)
    .maybeSingle();
  // Reply to the exact wa_id WhatsApp used (it may lack the 9 of new numbers).
  const touched = new Map<string, string>();
  for (const message of messages) {
    if (message.phoneNumberId && message.phoneNumberId !== account.phoneNumberId) continue;
    const { brazilPhone } = await import("./whatsapp");
    const phone = brazilPhone(message.from);
    const conversation =
      (await repo.byPhone("whatsapp", phone)) ||
      (await repo.create({
        channel: "whatsapp",
        contactPhone: phone,
        contactName: message.name,
      }));
    const body = message.audioId
      ? await audioText(() => downloadWhatsAppMedia(message.audioId!, account.token))
      : message.text;
    if (!(await repo.addMessage(conversation.id, "customer", body, message.id))) continue;
    if (message.name && !conversation.contactName)
      await repo.update(conversation.id, { contactName: message.name });
    if (conversation.status === "closed")
      await repo.update(conversation.id, { status: settings?.assistant_enabled ? "ai" : "human" });
    if (conversation.status !== "ai" || !settings?.assistant_enabled)
      await repo.update(conversation.id, { unreadDelta: 1 });
    touched.set(conversation.id, message.from);
  }
  return async () => {
    if (!settings?.assistant_enabled) return;
    for (const [id, waId] of touched) {
      const conversation = await repo.get(id);
      if (!conversation || conversation.status !== "ai") continue;
      await processConversation(repo, id, {
        origin,
        slug,
        send: (body) =>
          sendWhatsApp({
            phoneNumberId: account.phoneNumberId,
            token: account.token,
            to: waId,
            body,
          }),
      });
    }
  };
}

/* ------------------------------------------------------------------ */
/* Instagram Direct                                                    */
/* ------------------------------------------------------------------ */

export interface InstagramAccount {
  businessId: string;
  tenantId: string;
  igUserId: string;
  token: string;
  appSecret: string;
  verifyTokenHash: Buffer;
}

export async function instagramAccount(businessId: string): Promise<InstagramAccount | null> {
  const { data } = await createSupabaseAdmin()
    .from("instagram_accounts")
    .select("business_id,tenant_id,ig_user_id,access_token_enc,app_secret_enc,verify_token_hash")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data) return null;
  return {
    businessId: data.business_id,
    tenantId: data.tenant_id,
    igUserId: data.ig_user_id,
    token: decryptSecret(data.access_token_enc),
    appSecret: decryptSecret(data.app_secret_enc),
    verifyTokenHash: Buffer.from(String(data.verify_token_hash).replace(/^\\x/, ""), "hex"),
  };
}

/**
 * A delivery from Instagram for one business, already authenticated by the
 * signature. Same flow as WhatsApp; the AI asks for the WhatsApp to book.
 */
export async function receiveInstagram(
  account: InstagramAccount,
  messages: InstagramMessage[],
  origin: string,
) {
  const slug = await slugOf(account.businessId);
  const access = await readBusinessAccess(account.businessId);
  if (!accessOpen(access) || !hasModule(access.modules, "recepcionista")) return async () => {};
  const repo = liveRepo(account.businessId, account.tenantId);
  const { data: settings } = await createSupabaseAdmin()
    .from("business_settings")
    .select("assistant_enabled")
    .eq("business_id", account.businessId)
    .maybeSingle();
  const touched = new Map<string, string>();
  for (const message of messages) {
    if (message.recipient && message.recipient !== account.igUserId) continue;
    const conversation =
      (await repo.byRef("instagram", message.from)) ||
      (await repo.create({
        channel: "instagram",
        contactPhone: "",
        contactName: "",
        contactRef: message.from,
      }));
    const body = message.audioUrl
      ? await audioText(() => downloadUrl(message.audioUrl!))
      : message.text;
    if (!(await repo.addMessage(conversation.id, "customer", body, message.id))) continue;
    if (conversation.status === "closed")
      await repo.update(conversation.id, { status: settings?.assistant_enabled ? "ai" : "human" });
    if (conversation.status !== "ai" || !settings?.assistant_enabled)
      await repo.update(conversation.id, { unreadDelta: 1 });
    touched.set(conversation.id, message.from);
  }
  return async () => {
    if (!settings?.assistant_enabled) return;
    for (const [id, to] of touched) {
      const conversation = await repo.get(id);
      if (!conversation || conversation.status !== "ai") continue;
      await processConversation(repo, id, {
        origin,
        slug,
        send: (body) =>
          sendInstagram({ igUserId: account.igUserId, token: account.token, to, body }),
      });
    }
  };
}
