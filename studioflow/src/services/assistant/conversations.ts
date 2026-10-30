import { randomUUID } from "node:crypto";
import { cleanName } from "@/lib/person-name";
import { dropPendingCharge } from "../server-payments";
import {
  changeBooking,
  manageReply,
  moveDoneEvent,
  pendingMove,
} from "./manage-booking";
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
import { notifyNewBooking } from "../whatsapp/notify";
import { activityWhen, logActivity } from "../activity";
import { bookWithPayments, getPaymentAccount } from "../server-payments";
import { decryptSecret, newToken, sha256 } from "../server-secrets";
import { camel, getPublicStore } from "../server-store";
import { accessOpen } from "@/lib/access";
import { hasModule } from "@/lib/modules";
import { runAssistant, resumeHistory, type CreateMessage } from "./agent";
import { businessCreate } from "./provider";
import { platformAiEnabled } from "../platform-ai-control";
import { assistantScheduleOpen } from "@/lib/assistant-schedule";
import {
  bookingMenu,
  menuChoiceReply,
  menuPageReply,
  whatsappText,
  type BookingMenu,
} from "./booking-menu";
import { sendWhatsApp } from "./whatsapp";
import { sendInstagram, type InstagramMessage } from "./instagram";
import { audioText, downloadUrl, downloadWhatsAppMedia } from "./transcribe";
import { synthesizeWhatsAppReply } from "./speech";
import {
  contextText,
  conversationContext,
  customerBookingContext,
  referencesPreviousBooking,
  vagueBookingRequest,
  understandMessage,
  nameAnswer,
} from "./understanding";
import { failureCode, retryable, type RunProgress } from "./pipeline";
import { n8nWhatsAppTurn } from "./n8n-whatsapp-contract";
import {
  n8nWhatsAppConfiguration,
  requestN8nTurn,
  N8nTurnError,
} from "./n8n-whatsapp";
import { verifiedN8nReply } from "./n8n-reply";
import { finishConfirmedBooking } from "./confirmed-booking";
import { routineReply } from "./routine-reply";
import { welcomeReply } from "./welcome-reply";
import { conversationalReply } from "./conversation-tone";
import { productReply } from "./product-reply";
import { generalReply } from "./general-reply";
import { availabilityReply } from "./availability-reply";
import { imageUnavailableText, understandImage } from "./vision";
import type { AssistantContext } from "./agent";
import { manualPauseMs, whatsappBurstDelayMs } from "./idle-price-resume";
import { assistantMayAnswer, pureGreeting } from "./contact-scope";

type History = Anthropic.Beta.BetaMessageParam[];
type AssistantSettingsRow = {
  assistant_enabled: boolean;
  assistant_schedule_enabled: boolean;
  open_days: number[];
  open_start: string;
  open_end: string;
};
function assistantAllowedNow(settings: AssistantSettingsRow | null, at = new Date()) {
  return Boolean(
    settings?.assistant_enabled &&
      assistantScheduleOpen(
        {
          enabled: settings.assistant_schedule_enabled === true,
          days: settings.open_days || [],
          start: settings.open_start || "",
          end: settings.open_end || "",
        },
        at,
      ),
  );
}
function cursorBefore(value: string) {
  const time = Date.parse(value);
  return new Date(Number.isFinite(time) ? time - 1 : Date.now() - 1).toISOString();
}
export interface Conversation {
  id: string;
  whatsappProfessionalId?: string | null;
  channel: ConversationChannel;
  contactPhone: string;
  contactName: string;
  /** Instagram: id de quem escreveu. */
  contactRef?: string;
  status: ConversationStatus;
  unread: number;
  history: History;
  aiCursor: string;
  processingUntil?: string | null;
  updatedAt?: string;
}
type Role = ConversationMessage["role"];

/** Storage behind conversations: Supabase in production, files in the demo. */
export interface ConversationRepo {
  businessId: string;
  byToken(tokenHash: string): Promise<Conversation | null>;
  byPhone(
    channel: ConversationChannel,
    phone: string,
    professionalId?: string,
  ): Promise<Conversation | null>;
  /** Instagram: a conversa de quem escreveu. */
  byRef(
    channel: ConversationChannel,
    ref: string,
  ): Promise<Conversation | null>;
  get(id: string): Promise<Conversation | null>;
  create(input: {
    channel: ConversationChannel;
    contactPhone: string;
    contactName: string;
    contactRef?: string;
    tokenHash?: string;
    professionalId?: string;
  }): Promise<Conversation>;
  /** False when this provider message was already stored. */
  addMessage(
    id: string,
    role: Role,
    body: string,
    providerId?: string,
    createdAt?: string,
  ): Promise<boolean>;
  messages(id: string, since?: string): Promise<ConversationMessage[]>;
  lease(id: string): Promise<boolean>;
  release(id: string): Promise<void>;
  update(
    id: string,
    patch: Partial<
      Pick<
        Conversation,
        "history" | "aiCursor" | "status" | "contactName" | "contactPhone"
      >
    > & {
      unreadDelta?: number;
      unread?: number;
    },
  ): Promise<void>;
  takeTurn(): Promise<boolean>;
  addTokens(input: number, output: number): Promise<void>;
  startRun?(id: string, cursor: string): Promise<number>;
  progress?(id: string, patch: RunProgress): Promise<void>;
  run?(id: string): Promise<{
    state: string;
    attempts: number;
    interpretation?: unknown;
    error_code?: string | null;
    updated_at?: string;
  } | null>;
  seen?(providerId: string): Promise<boolean>;
  bookedSince?(id: string, since: string): Promise<boolean>;
  resumeIdlePrice?(
    conversation: Conversation,
    cursor: string,
  ): Promise<boolean>;
}

const hex = (token: string) => sha256(token).toString("hex");
const toBytea = (value: string) => `\\x${value}`;

/** Provider history is an opaque protocol payload, not database columns. */
export function conversationFromRow(data: unknown): Conversation | null {
  if (!data) return null;
  const { history, ...columns } = data as Record<string, unknown>;
  return {
    ...(camel(columns) as Omit<Conversation, "history">),
    history: (history || []) as History,
  };
}

export function liveRepo(
  businessId: string,
  tenantId: string,
): ConversationRepo {
  const admin = createSupabaseAdmin();
  const columns =
    "id,channel,contact_phone,contact_name,contact_ref,status,unread,history,ai_cursor,whatsapp_professional_id,processing_until,updated_at";
  const one = async (query: PromiseLike<{ data: unknown }>) => {
    const { data } = await query;
    return conversationFromRow(data);
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
    byPhone: (channel, phone, professionalId) =>
      one(
        admin
          .from("conversations")
          .select(columns)
          .eq("business_id", businessId)
          .eq("channel", channel)
          .eq("contact_phone", phone)
          .or(
            professionalId
              ? `whatsapp_professional_id.eq.${professionalId}`
              : "whatsapp_professional_id.is.null",
          )
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
          // New conversations have not handled any messages yet. The database
          // default (now()) can be later than a provider's inbound timestamp,
          // which would make the first WhatsApp message look already handled.
          ai_cursor: new Date(0).toISOString(),
          whatsapp_professional_id: input.professionalId || null,
          contact_phone: input.contactPhone,
          contact_name: input.contactName.slice(0, 100),
          contact_ref: input.contactRef || "",
          token_hash: input.tokenHash ? toBytea(input.tokenHash) : null,
        })
        .select(columns)
        .single();
      if (error?.code === "23505" && input.channel === "whatsapp") {
        const existing = await this.byPhone(
          "whatsapp",
          input.contactPhone,
          input.professionalId,
        );
        if (existing) return existing;
      }
      if (
        error?.code === "23505" &&
        input.channel === "instagram" &&
        input.contactRef
      ) {
        const existing = await this.byRef("instagram", input.contactRef);
        if (existing) return existing;
      }
      if (error || !data)
        throw new DomainError("Não foi possível abrir a conversa.", 503);
      return camel(data) as Conversation;
    },
    async addMessage(id, role, body, providerId, createdAt) {
      const { error } = await admin.from("conversation_messages").insert({
        tenant_id: tenantId,
        business_id: businessId,
        conversation_id: id,
        role,
        body: body.slice(0, 4000),
        provider_message_id: providerId || null,
        ...(createdAt ? { created_at: createdAt } : {}),
      });
      if (error?.code === "23505") return false;
      if (error)
        throw new DomainError("Não foi possível guardar a mensagem.", 503);
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
        .order("created_at", { ascending: false })
        .limit(500);
      if (since) query = query.gt("created_at", since);
      const { data, error } = await query;
      if (error)
        throw new DomainError("Não foi possível ler o histórico.", 503);
      return camel((data || []).reverse()) as ConversationMessage[];
    },
    async lease(id) {
      const { data } = await admin.rpc("conversation_lease", {
        p_conversation_id: id,
      });
      return data === true;
    },
    async resumeIdlePrice(conversation, cursor) {
      if (!conversation.updatedAt) return false;
      const { data, error } = await admin
        .from("conversations")
        .update({ status: "ai", ai_cursor: cursor, history: [], unread: 0 })
        .eq("business_id", businessId)
        .eq("id", conversation.id)
        .eq("status", "human")
        .eq("updated_at", conversation.updatedAt)
        .select("id");
      if (error) throw new Error("idle-price-resume-unavailable");
      return data?.length === 1;
    },
    async release(id) {
      await admin
        .from("conversations")
        .update({ processing_until: null })
        .eq("id", id);
    },
    async update(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.history) row.history = patch.history;
      if (patch.aiCursor) row.ai_cursor = patch.aiCursor;
      if (patch.status) row.status = patch.status;
      if (patch.contactName !== undefined)
        row.contact_name = patch.contactName.slice(0, 100);
      if (patch.contactPhone !== undefined)
        row.contact_phone = patch.contactPhone;
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
        await admin
          .from("conversations")
          .update(row)
          .eq("business_id", businessId)
          .eq("id", id);
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
    async seen(providerId) {
      const { data, error } = await admin
        .from("conversation_messages")
        .select("id")
        .eq("business_id", businessId)
        .eq("provider_message_id", providerId)
        .limit(1);
      if (error) throw new Error("message-dedup-unavailable");
      return !!data?.length;
    },
    async bookedSince(id, since) {
      const { data, error } = await admin
        .from("appointments")
        .select("id")
        .eq("business_id", businessId)
        .eq("conversation_id", id)
        .gte("created_at", since)
        .limit(1);
      if (error) throw new Error("booking-recovery-check-unavailable");
      return !!data?.length;
    },
    async startRun(id, cursor) {
      const { data, error } = await admin.rpc("start_assistant_run", {
        p_id: id,
        p_cursor: cursor,
      });
      if (error || typeof data !== "number")
        throw new Error("pipeline-unavailable");
      return data;
    },
    async progress(id, patch) {
      const { error } = await admin
        .from("assistant_runs")
        .update({
          state: patch.state,
          ...(patch.interpretation !== undefined
            ? { interpretation: patch.interpretation }
            : {}),
          ...(patch.errorCode !== undefined
            ? { error_code: patch.errorCode }
            : {}),
          ...(patch.retryAt !== undefined ? { retry_at: patch.retryAt } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", businessId)
        .eq("conversation_id", id);
      if (error) throw new Error("pipeline-unavailable");
    },
    async run(id) {
      const { data } = await admin
        .from("assistant_runs")
        .select("state,attempts,interpretation,error_code,updated_at")
        .eq("business_id", businessId)
        .eq("conversation_id", id)
        .maybeSingle();
      return data;
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
  const read = async <T>(fn: (store: Store) => T) => fn(await readDemo(slug));
  return {
    businessId,
    byToken: (tokenHash) =>
      read((store) =>
        view(store.conversations?.find((item) => item.tokenHash === tokenHash)),
      ),
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
        item.messages.push({
          id: randomUUID(),
          role,
          body: body.slice(0, 4000),
          createdAt,
        });
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
        if (patch.contactName !== undefined)
          item.contactName = patch.contactName;
        if (patch.contactPhone !== undefined)
          item.contactPhone = patch.contactPhone;
        if (patch.unread !== undefined) item.unread = patch.unread;
        if (patch.unreadDelta)
          item.unread = Math.max(0, item.unread + patch.unreadDelta);
      }, slug),
    takeTurn: async () => true,
    addTokens: async () => undefined,
  };
}

export interface Delivery {
  /** Sends the assistant's answer out (WhatsApp); the web chat polls. */
  send?: (body: string, menu?: BookingMenu | null) => Promise<string | void>;
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
  create?: CreateMessage | null,
) {
  for (let round = 0; round < 3; round++) {
    if (!(await platformAiEnabled())) {
      // Keep the AI assignment intact. The global switch pauses generation;
      // switching it back on should resume eligible chats automatically.
      return;
    }
    if (!(await repo.lease(conversationId))) return;
    let say: string | null = null;
    try {
      say = await answerPending(
        repo,
        conversationId,
        delivery,
        create === undefined ? await businessCreate(repo.businessId) : create,
      );
    } catch (error) {
      const code = failureCode(error);
      const run = await repo.run?.(conversationId);
      // Only retry generation/understanding. An uncertain outbound send must
      // never be resent automatically, and a person taking over keeps control.
      if (
        run &&
        run.state !== "SENDING" &&
        !(error instanceof N8nTurnError) &&
        run.attempts < 3 &&
        retryable(error) &&
        (await repo.get(conversationId))?.status === "ai"
      ) {
        await repo.progress?.(conversationId, {
          state: "RETRY",
          errorCode: code,
          retryAt: new Date(Date.now() + 30_000).toISOString(),
        });
        await repo.addMessage(
          conversationId,
          "event",
          "StudioFlow está tentando novamente após uma falha temporária.",
        );
        return;
      }
      console.error("StudioFlow assistant error:", {
        category: code,
        status:
          error &&
          typeof error === "object" &&
          "status" in error &&
          typeof error.status === "number"
            ? error.status
            : null,
        timeout: error instanceof Error && /Timeout/i.test(error.name),
      });
      await repo.progress?.(conversationId, {
        state: "FAILED",
        errorCode: run?.state === "SENDING" ? "delivery-unconfirmed" : code,
      });
      await repo
        .update(conversationId, { status: "human", unreadDelta: 1 })
        .catch(() => undefined);
      await repo
        .addMessage(
          conversationId,
          "event",
          `StudioFlow precisa de atenção: ${run?.state === "SENDING" ? "envio sem confirmação; confira o WhatsApp antes de reenviar" : code}. A conversa está com a equipe.`,
        )
        .catch(() => undefined);
      const failed = await repo.get(conversationId).catch(() => null);
      say = failed && failed.channel !== "whatsapp" ? handoffNotice : null;
      if (say)
        await repo
          .addMessage(conversationId, "assistant", say)
          .catch(() => undefined);
    } finally {
      await repo.release(conversationId);
    }
    if (!say) return;
    // Delivery happens inside the lease, before recording a successful answer.
  }
}

/** answerPending's signal that newer messages arrived: run another round. */
const superseded = "\u0000superseded";

/** One answer for the pending messages; null when there is nothing to do. */
async function answerPending(
  repo: ConversationRepo,
  conversationId: string,
  delivery: Delivery,
  create: CreateMessage | null,
): Promise<string | null> {
  const conversation = await repo.get(conversationId);
  if (!conversation || conversation.status !== "ai") return null;
  const pending = (
    await repo.messages(conversationId, conversation.aiCursor)
  ).filter(
    (message) => message.role === "customer" || message.role === "staff",
  );
  if (!pending.some((message) => message.role === "customer")) return null;
  const cursor = pending.at(-1)!.createdAt;
  const replyTime = new Date(cursor);
  const text =
    pending.length === 1
      ? pending[0].body
      : pending
          .slice(-20)
          .map(
            (message) =>
              `${message.role === "staff" ? "Equipe" : "Cliente"}: ${message.body}`,
          )
          .join("\n");
  const toHuman = async (reason: string) => {
    await repo.update(conversationId, {
      aiCursor: cursor,
      status: "human",
      unreadDelta: 1,
    });
    await repo.addMessage(conversationId, "event", reason);
    // Without subject verification, a configuration/cost problem must not
    // trigger an unsolicited WhatsApp reply to a personal conversation.
    if (conversation.channel === "whatsapp") return null;
    await repo.addMessage(conversationId, "assistant", handoffNotice);
    return handoffNotice;
  };
  const store = await loadStore(delivery.slug);
  if (
    !assistantScheduleOpen(
      {
        enabled: store.settings.assistantScheduleEnabled,
        days: store.settings.openDays,
        start: store.settings.openStart,
        end: store.settings.openEnd,
      },
      new Date(cursor),
    )
  ) {
    await repo.update(conversationId, { aiCursor: cursor, unreadDelta: 1 });
    return null;
  }
  if (!(await platformAiEnabled()))
    return toHuman("IA desativada pelo admin da plataforma.");
  if (
    conversation.channel === "whatsapp" &&
    (await repo.run?.(conversationId))?.state === "SENDING"
  )
    return toHuman(
      "Execução anterior sem conclusão. Confira o WhatsApp antes de retomar; nenhum reenvio automático foi feito.",
    );
  // A crash after booking but before the reply must not execute the same
  // commercial mutation again when the recovery scanner picks up this cursor.
  if (
    conversation.channel === "whatsapp" &&
    (await repo.bookedSince?.(conversationId, cursor))
  ) {
    await repo.progress?.(conversationId, {
      state: "FAILED",
      errorCode: "appointment-created",
    });
    return toHuman(
      "O agendamento já está registrado. Confira a agenda para confirmar o atendimento ao cliente; a recuperação não criou outro horário.",
    );
  }
  let understanding: Awaited<ReturnType<typeof understandMessage>> | undefined;
  // Every number represents the same business. Let customers compare every
  // active professional rather than silently narrowing availability to the
  // WhatsApp number that received the message.
  const scopedStore = store;
  const bookingContext =
    conversation.channel === "whatsapp" &&
    (referencesPreviousBooking(text) || vagueBookingRequest(text))
      ? customerBookingContext(
          scopedStore,
          conversation.contactPhone,
          conversation.whatsappProfessionalId || undefined,
          pending[0].createdAt,
        )
      : "";
  const recent = conversationContext(
    await repo.messages(conversationId),
    pending[0].createdAt,
    text,
    scopedStore,
  );
  if (conversation.channel === "whatsapp" && !text.trim()) {
    await repo.startRun?.(conversationId, cursor);
    await repo.update(conversationId, { aiCursor: cursor });
    await repo.progress?.(conversationId, { state: "SILENT" });
    return null;
  }
  // Cancel/reschedule is answered from the agenda, without a model call.
  const customerText = pending.filter((m) => m.role === "customer").at(-1)!.body;
  const managed =
    conversation.channel === "whatsapp" &&
    !pending.some((message) => message.role === "staff")
      ? await manageReply({
          store: scopedStore,
          text: customerText,
          messages: await repo.messages(conversationId),
          phone: conversation.contactPhone,
          change: (action, appointment) =>
            changeBooking(
              delivery.slug,
              scopedStore,
              appointment,
              conversation.contactPhone,
              action,
            ),
        })
      : null;
  if (managed) {
    await repo.startRun?.(conversationId, cursor);
    if (managed.cancelled) {
      await dropPendingCharge(managed.cancelled).catch(() => undefined);
      await logActivity(scopedStore.business.id, {
        source: "recepcionista",
        action: "Cancelou pelo WhatsApp",
        detail: `${managed.cancelled.customerName} · ${activityWhen(managed.cancelled.start)}`,
        actor: "Recepcionista",
      });
    }
    if ((await repo.get(conversationId))?.status !== "ai") return null;
    await repo.progress?.(conversationId, { state: "SENDING" });
    let sentId = await delivery.send?.(
      managed.reply,
      managed.handoff ? null : managed.menu || null,
    );
    if (
      sentId &&
      conversation.whatsappProfessionalId &&
      !sentId.startsWith(`${conversation.whatsappProfessionalId}:`)
    )
      sentId = `${conversation.whatsappProfessionalId}:${sentId}`;
    await repo.addMessage(
      conversationId,
      "assistant",
      managed.reply,
      sentId || undefined,
    );
    if (managed.event)
      await repo.addMessage(conversationId, "event", managed.event);
    await repo.update(conversationId, {
      aiCursor: cursor,
      history: [
        ...conversation.history,
        { role: "user", content: text },
        { role: "assistant", content: managed.reply },
      ].slice(-40) as History,
      ...(managed.handoff ? { status: "human", unreadDelta: 1 } : {}),
    });
    await repo.progress?.(conversationId, { state: "SENT" });
    if (managed.handoff)
      await repo.addMessage(
        conversationId,
        "event",
        `Pediu a equipe: ${managed.handoff}`,
      );
    return managed.reply;
  }
  if (!create) {
    await repo.progress?.(conversationId, {
      state: "FAILED",
      errorCode: "missing-key",
    });
    return toHuman(
      "Atendente virtual sem chave de IA configurada no servidor.",
    );
  }
  if (conversation.history.length > 160)
    return toHuman("Conversa longa: a atendente virtual passou para a equipe.");
  if (!(await repo.takeTurn())) {
    await repo.progress?.(conversationId, {
      state: "FAILED",
      errorCode: "daily-limit",
    });
    return toHuman("Limite diário da atendente virtual atingido.");
  }
  if (conversation.channel === "whatsapp") {
    await repo.startRun?.(conversationId, cursor);
    understanding = await understandMessage(
      create,
      text,
      scopedStore,
      recent,
      pending[0].createdAt,
      bookingContext,
      store.customers.find(
        (customer) =>
          customer.phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "") ===
          conversation.contactPhone,
      )?.name || "",
    );
    await repo.addTokens(understanding.usage.input, understanding.usage.output);
    await repo.progress?.(conversationId, {
      state: "UNDERSTOOD",
      interpretation: understanding.interpretation,
    });
    if (understanding.interpretation.nextAction === "SILENCE") {
      await repo.update(conversationId, { aiCursor: cursor });
      await repo.progress?.(conversationId, { state: "SILENT" });
      return null;
    }
    await repo.progress?.(conversationId, { state: "DECIDING" });
  }
  const payments = isDemo()
    ? !!store.paymentAccount
    : !!(await getPaymentAccount(store.business.id));
  const n8n =
    conversation.channel === "whatsapp"
      ? n8nWhatsAppConfiguration(
          repo.businessId,
          conversation.whatsappProfessionalId,
        )
      : null;
  let moved = false;
  const ctx: AssistantContext = {
    channel: conversation.channel,
    professionalId: undefined,
    customerName:
      store.customers.find(
        (customer) =>
          customer.phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "") ===
          conversation.contactPhone,
      )?.name ||
      // Someone who already has a booking from this number is known by it.
      cleanName(
        store.appointments.find(
          (a) =>
            a.status !== "cancelled" &&
            a.customerPhone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "") ===
              conversation.contactPhone,
        )?.customerName || "",
      ) ||
      nameAnswer(text, recent),
    verifiedPhone:
      conversation.channel === "whatsapp"
        ? conversation.contactPhone
        : undefined,
    origin: delivery.origin,
    payments,
    loadStore: () => loadStore(delivery.slug),
    book: async (input) => {
      if (text.includes("Consultar a opção:"))
        throw new DomainError(
          "O cliente apenas selecionou uma opção do menu. Peça a confirmação antes de reservar.",
          409,
        );
      if (!(await platformAiEnabled()))
        throw new DomainError("IA desligada pelo admin.", 409);
      const fresh = await repo.get(conversationId);
      if (
        fresh?.status !== "ai" ||
        fresh.aiCursor !== conversation.aiCursor ||
        (fresh.processingUntil &&
          Date.parse(fresh.processingUntil) <= Date.now())
      )
        throw new DomainError(
          "A equipe assumiu esta conversa ou o processamento expirou.",
          409,
        );
      if (await repo.bookedSince?.(conversationId, cursor))
        throw new DomainError("O pedido já possui um agendamento.", 409);
      // A "remarcar" asked in this chat moves that appointment instead of
      // creating a second one.
      const moving =
        conversation.channel === "whatsapp"
          ? pendingMove(
              await repo.messages(conversationId),
              await loadStore(delivery.slug),
              conversation.contactPhone,
            )
          : undefined;
      if (moving) {
        const appointment = await changeBooking(
          delivery.slug,
          scopedStore,
          moving,
          conversation.contactPhone,
          "reschedule",
          input.start,
          input.professionalId,
        );
        moved = true;
        await repo.addMessage(
          conversationId,
          "event",
          moveDoneEvent(moving.id),
        );
        await notifyNewBooking(delivery.slug, appointment.id, delivery.origin);
        await logActivity(appointment.businessId, {
          source: "recepcionista",
          action: "Remarcou pelo WhatsApp",
          detail: `${appointment.customerName} · ${activityWhen(appointment.start)}`,
          actor: "Recepcionista",
        });
        return appointment;
      }
      const appointment = await bookWithPayments(
        delivery.slug,
        {
          serviceIds: input.serviceIds,
          professionalId: input.professionalId,
          start: input.start,
          name: cleanName(input.name),
          phone: input.phone,
          email: "",
          reminder: true,
          cpf: input.cpf,
        },
        conversation.channel === "web" ? "public_link" : "receptionist",
        { channel: conversation.channel, conversationId: conversation.id },
      );
      await notifyNewBooking(delivery.slug, appointment.id, delivery.origin);
      await logActivity(appointment.businessId, {
        source: "recepcionista",
        action: `Agendou pelo ${conversation.channel === "whatsapp" ? "WhatsApp" : conversation.channel === "instagram" ? "Instagram" : "chat da página"}`,
        detail: `${appointment.customerName} · ${activityWhen(appointment.start)}`,
        actor: "Recepcionista",
      });
      return appointment;
    },
  };
  const direct =
    understanding && !pending.some((message) => message.role === "staff")
      ? menuChoiceReply(
          scopedStore,
          understanding.interpretation,
          text,
          ctx.customerName,
        ) ||
        menuPageReply(text) ||
        productReply(text, scopedStore, recent) ||
        availabilityReply(
          understanding.interpretation,
          scopedStore,
          text,
          recent,
        ) ||
        routineReply(understanding.interpretation, scopedStore, {
          text,
          recent,
        })
      : null;
  let general = null;
  if (!direct && understanding?.interpretation.intent === "GENERAL") {
    await repo.progress?.(conversationId, { state: "GENERATING" });
    general = await generalReply(create, text, scopedStore, recent);
  }
  const closed =
    general ||
    (direct
      ? ({
          history: conversation.history,
          reply: conversationalReply(
            direct,
            understanding?.interpretation.acknowledgement,
            recent,
          ),
          usage: { input: 0, output: 0 },
        } as import("./agent").TurnResult)
      : understanding && !pending.some((message) => message.role === "staff")
        ? await finishConfirmedBooking({
            selection: understanding.interpretation,
            text,
            recent,
            store: scopedStore,
            ctx,
            beforeBooking: async () => {
              // A crash after mutation must go to review rather than replay a booking.
              await repo.progress?.(conversationId, {
                state: "SENDING",
                interpretation: understanding.interpretation,
              });
            },
          })
        : null);
  if (closed)
    closed.history = [
      ...conversation.history,
      { role: "user", content: text },
      { role: "assistant", content: closed.reply },
    ].slice(-40) as History;
  if (n8n && understanding && !closed) {
    if (store.business.id !== repo.businessId) throw new N8nTurnError();
    if (!repo.startRun || !repo.progress || !repo.run) throw new N8nTurnError();
    if (pending.some((message) => message.role === "staff"))
      return toHuman(
        "A equipe participou deste turno; continue o atendimento manualmente.",
      );
    const turn = n8nWhatsAppTurn({
      businessId: repo.businessId,
      professionalId: conversation.whatsappProfessionalId || null,
      conversationId,
      channel: "whatsapp",
      status: "ai",
      messages: pending.slice(-20).map((message) => ({
        id: message.id,
        text: message.body,
        createdAt: message.createdAt,
      })),
    });
    const timeLeft = conversation.processingUntil
      ? Date.parse(conversation.processingUntil) - Date.now() - 5000
      : 45_000;
    if (timeLeft < 5000) throw new N8nTurnError();
    // Persist the uncertain boundary BEFORE dispatch. Recovery must not repeat
    // a charged external turn after a process crash, timeout or malformed reply.
    await repo.progress(conversationId, {
      state: "SENDING",
      interpretation: {
        ...understanding.interpretation,
        engine: "n8n",
        requestId: turn.requestId,
        externalUsage: "available-in-n8n-and-provider",
      },
    });
    // External usage is not returned by v1. Do not fabricate measured tokens:
    // the workflow caps iterations/output and shares the daily turn budget.
    try {
      const proposed = await requestN8nTurn(turn, n8n, fetch, timeLeft);
      if (!(await platformAiEnabled())) {
        await repo.update(conversationId, { aiCursor: cursor, unreadDelta: 1 });
        return null;
      }
      const fresh = await repo.get(conversationId);
      if (fresh?.status !== "ai") return null;
      if (
        fresh.aiCursor !== conversation.aiCursor ||
        (fresh.processingUntil &&
          Date.parse(fresh.processingUntil) <= Date.now())
      )
        throw new N8nTurnError();
      const freshStore = await loadStore(delivery.slug);
      if (
        !freshStore.settings.assistantEnabled ||
        freshStore.business.id !== repo.businessId
      )
        throw new N8nTurnError();
      const verified = verifiedN8nReply(
        proposed.output,
        understanding.interpretation,
        freshStore,
        text,
      );
      verified.reply = whatsappText(
        welcomeReply(verified.reply, recent, text, replyTime),
      );
      if ((await repo.get(conversationId))?.status !== "ai") return null;
      const handoff = proposed.handoff || verified.handoff;
      let sentId = await delivery.send?.(
        verified.reply,
        handoff
          ? null
          : bookingMenu(scopedStore, understanding.interpretation, text),
      );
      if (
        sentId &&
        conversation.whatsappProfessionalId &&
        !sentId.startsWith(`${conversation.whatsappProfessionalId}:`)
      )
        sentId = `${conversation.whatsappProfessionalId}:${sentId}`;
      await repo.addMessage(
        conversationId,
        "assistant",
        verified.reply,
        sentId || undefined,
      );
      await repo.update(conversationId, {
        aiCursor: cursor,
        history: [
          ...conversation.history,
          { role: "user", content: text },
          { role: "assistant", content: verified.reply },
        ].slice(-40) as History,
        ...(handoff ? { status: "human", unreadDelta: 1 } : {}),
      });
      await repo.progress(conversationId, { state: "SENT" });
      if (handoff)
        await repo.addMessage(
          conversationId,
          "event",
          "Pedido encaminhado à equipe; n8n não realiza reservas.",
        );
      return verified.reply;
    } catch {
      throw new N8nTurnError();
    }
  }
  const result =
    closed ||
    (await runAssistant({
      create,
      store,
      history: conversation.history,
      interpretation: understanding?.interpretation,
      transcript: contextText(recent),
      bookingContext,
      onStage: async (state) => {
        if (understanding) await repo.progress?.(conversationId, { state });
      },
      customerText: text,
      ctx,
    }));
  if (moved && result.reply)
    result.reply = result.reply.replace(
      /^Tudo certo! Agendamento confirmado para/,
      "Pronto! Seu horário foi remarcado para",
    );
  // A person may take over while the provider is generating a response.
  // Keep their control and charge the actual usage without publishing that reply.
  await repo.addTokens(result.usage.input, result.usage.output);
  if (result.reply) {
    const original = result.reply;
    result.reply = welcomeReply(original, recent, text, replyTime);
    if (conversation.channel === "whatsapp")
      result.reply = whatsappText(result.reply);
    const last = result.history.at(-1);
    if (last?.role === "assistant" && last.content === original)
      result.history = [
        ...result.history.slice(0, -1),
        { role: "assistant", content: result.reply },
      ];
  }
  if (!(await platformAiEnabled())) {
    await repo.update(conversationId, { aiCursor: cursor, unreadDelta: 1 });
    return null;
  }
  if ((await repo.get(conversationId))?.status !== "ai") return null;
  // The customer kept typing while this answer was generated: answer all of it
  // in the next round instead of sending a reply that ignores the new messages.
  if (
    conversation.channel === "whatsapp" &&
    !result.booked &&
    !result.handoff &&
    (await repo.messages(conversationId, cursor)).some(
      (message) => message.role === "customer",
    )
  )
    return superseded;
  let sentId: string | void = undefined;
  if (result.reply && delivery.send) {
    if (understanding)
      await repo.progress?.(conversationId, { state: "SENDING" });
    sentId = await delivery.send(
      result.reply,
      result.booked || result.handoff || pureGreeting(result.reply)
        ? null
        : bookingMenu(scopedStore, understanding?.interpretation, text),
    );
    if (
      sentId &&
      conversation.whatsappProfessionalId &&
      !sentId.startsWith(`${conversation.whatsappProfessionalId}:`)
    )
      sentId = `${conversation.whatsappProfessionalId}:${sentId}`;
  }
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
  if (result.reply)
    await repo.addMessage(
      conversationId,
      "assistant",
      result.reply,
      sentId || undefined,
    );
  if (understanding)
    await repo.progress?.(conversationId, {
      state: result.reply ? "SENT" : "SILENT",
    });
  if (result.booked)
    await repo.addMessage(
      conversationId,
      "event",
      "Horário marcado pela atendente virtual.",
    );
  if (result.handoff)
    await repo.addMessage(
      conversationId,
      "event",
      `Pediu a equipe: ${result.handoff}`,
    );
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
    throw new DomainError(
      "O atendimento por chat não está disponível agora.",
      404,
    );
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
    throw new DomainError(
      "Esta conversa ficou longa. Fale com o estabelecimento pelo WhatsApp.",
      429,
    );
  await repo.addMessage(conversation.id, "customer", input.message);
  if (conversation.status !== "ai")
    await repo.update(conversation.id, {
      unreadDelta: 1,
      ...(conversation.status === "closed" ? { status: "human" as const } : {}),
    });
  else await processConversation(repo, conversation.id, { origin, slug });
  const fresh = await repo.get(conversation.id);
  return {
    token,
    status: fresh?.status || "ai",
    messages: visible(await repo.messages(conversation.id)),
    assistantName: store.settings.assistantName,
  };
}

export async function webChatView(
  slug: string,
  token: string,
): Promise<ChatView> {
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

export async function whatsappAccount(
  businessId: string,
): Promise<WhatsAppAccount | null> {
  const { data } = await createSupabaseAdmin()
    .from("whatsapp_accounts")
    .select(
      "business_id,tenant_id,phone_number_id,access_token_enc,app_secret_enc,verify_token_hash",
    )
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data) return null;
  return {
    businessId: data.business_id,
    tenantId: data.tenant_id,
    phoneNumberId: data.phone_number_id,
    token: decryptSecret(data.access_token_enc),
    appSecret: decryptSecret(data.app_secret_enc),
    verifyTokenHash: Buffer.from(
      String(data.verify_token_hash).replace(/^\\x/, ""),
      "hex",
    ),
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

/** One customer message from any WhatsApp connection. */
export interface IncomingWhatsApp {
  id: string;
  /** Sender with country code; answers go back to this exact number. */
  from: string;
  name: string;
  text: string;
  fromMe?: boolean;
  createdAt?: string;
  /** Voice note: transcribed before it is stored, when the server can. */
  loadAudio?: () => Promise<{ audio: ArrayBuffer; mime: string }>;
  /** Photo: analyzed by the configured AI provider before it is stored. */
  loadImage?: () => Promise<{ image: ArrayBuffer; mime: string }>;
}

/**
 * Messages that reached the business WhatsApp (Meta Cloud API or the QR
 * Code connection). Stores each one once; the AI answers when it is on.
 * Returns the work to run after the 200 goes back.
 */
export async function receiveWhatsAppMessages(input: {
  businessId: string;
  tenantId: string;
  origin: string;
  messages: IncomingWhatsApp[];
  professionalId?: string;
  send: (
    to: string,
    body: string,
    menu?: BookingMenu | null,
    audio?: Uint8Array,
  ) => Promise<string | void>;
}) {
  const slug = await slugOf(input.businessId);
  // Sem acesso liberado ou sem a recepcionista no plano: a mensagem não é tratada.
  const access = await readBusinessAccess(input.businessId);
  if (!accessOpen(access) || !hasModule(access.modules, "recepcionista"))
    return async () => {};
  const repo = liveRepo(input.businessId, input.tenantId);
  const { data: settings } = await createSupabaseAdmin()
    .from("business_settings")
    .select("assistant_enabled,assistant_schedule_enabled,open_days,open_start,open_end")
    .eq("business_id", input.businessId)
    .maybeSingle();
  const globalAiEnabled = await platformAiEnabled();
  const assistantActive =
    globalAiEnabled && assistantAllowedNow(settings as AssistantSettingsRow | null);
  const { brazilPhone } = await import("./whatsapp");
  // Reply to the exact number WhatsApp used (it may lack the 9 of new numbers).
  const touched = new Map<string, { to: string; replyWithAudio: boolean }>();
  let scopedCatalog: Awaited<ReturnType<typeof loadStore>> | undefined;
  const scopeStore = async () => (scopedCatalog ||= await loadStore(slug));
  for (const message of input.messages) {
    const providerId = input.professionalId
      ? `${input.professionalId}:${message.id}`
      : message.id;
    if (await repo.seen?.(providerId)) continue;
    const phone = brazilPhone(message.from);
    const existing = await repo.byPhone(
      "whatsapp",
      phone,
      input.professionalId,
    );
    if (message.fromMe) {
      // Only mirror an existing channel. A personal outgoing chat must not create
      // a lead or cause the assistant to answer the account owner's message.
      if (!existing) continue;
      if (
        !(await repo.addMessage(
          existing.id,
          "staff",
          message.text.trim() ||
            (message.loadAudio
              ? "[A equipe enviou um áudio.]"
              : message.loadImage
                ? "[A equipe enviou uma foto.]"
                : "[A equipe enviou uma mídia.]"),
          providerId,
          message.createdAt,
        ))
      )
        continue;
      if (
        !message.createdAt ||
        !existing.aiCursor ||
        message.createdAt >= existing.aiCursor
      )
        await repo.update(existing.id, {
          status: "human",
          unread: 0,
          aiCursor: message.createdAt || new Date().toISOString(),
          history: resumeHistory([], await repo.messages(existing.id)),
        });
      continue;
    }
    // Transcribe before checking intent, including a new customer's first audio.
    let body = message.loadAudio
      ? assistantActive
        ? await audioText(message.loadAudio, input.businessId)
        : "[Áudio recebido para atendimento manual]"
      : message.text;
    if (message.loadImage) {
      const caption = message.text
        .replace(/^\[O cliente enviou uma foto\.\]\s*/i, "")
        .trim();
      if (assistantActive) {
        try {
          const create = await businessCreate(input.businessId);
          if (!create) throw new Error("assistant-provider-unavailable");
          const understood = await understandImage(
            create,
            await message.loadImage(),
            caption,
          );
          body = understood.text;
          await repo.addTokens(understood.usage.input, understood.usage.output);
        } catch (error) {
          console.error("StudioFlow image understanding error:", {
            code:
              error instanceof Error && error.message === "unsupported-image"
                ? "unsupported-image"
                : "image-understanding-unavailable",
          });
          body = `${imageUnavailableText}${caption ? `\n${caption}` : ""}`;
        }
      }
    }
    if (!body.trim()) continue;
    if (!existing && !settings?.assistant_enabled) {
      const { data: customer, error } = await createSupabaseAdmin()
        .from("customers")
        .select("id")
        .eq("business_id", input.businessId)
        .in("phone", [phone, `55${phone}`])
        .limit(1);
      if (error) continue; // Fail closed: do not answer an unverified contact.
      if (!customer?.length) continue;
    }
    const conversation =
      existing ||
      (await repo.create({
        channel: "whatsapp",
        professionalId: input.professionalId,
        contactPhone: phone,
        contactName: message.name,
      }));
    if (
      !(await repo.addMessage(
        conversation.id,
        "customer",
        body,
        providerId,
        message.createdAt,
      ))
    )
      continue;
    if (message.name && !conversation.contactName)
      await repo.update(conversation.id, { contactName: message.name });
    if (!assistantActive) {
      // Keep today's conversation context without leaving the chat in a manual
      // state or replaying messages received while the automation was paused.
      await repo.update(conversation.id, {
        aiCursor: message.createdAt || new Date().toISOString(),
        unreadDelta: 1,
      });
      continue;
    }
    if (conversation.status === "human") {
      const messageAt = message.createdAt || new Date().toISOString();
      // Someone from the team is talking in this chat: the AI stays out.
      const personTalking = (await repo.messages(conversation.id)).some(
        (m) =>
          m.role === "staff" &&
          Date.parse(m.createdAt) > Date.parse(messageAt) - manualPauseMs,
      );
      if (personTalking) {
        await repo.update(conversation.id, { unreadDelta: 1 });
        continue;
      }
      const cursor = cursorBefore(messageAt);
      await repo.update(conversation.id, {
        status: "ai",
        aiCursor: cursor,
        unread: 0,
      });
      conversation.status = "ai";
      conversation.aiCursor = cursor;
    }
    if (conversation.status === "closed")
      await repo.update(conversation.id, {
        status: assistantActive ? "ai" : "human",
      });
    if (conversation.status !== "ai" || !assistantActive)
      await repo.update(conversation.id, { unreadDelta: 1 });
    // Personal contacts on the shop phone are left to the owner.
    const messageAt = message.createdAt || new Date().toISOString();
    const earlier = (await repo.messages(conversation.id)).filter(
      (m) => m.createdAt < messageAt,
    );
    if (
      !(await assistantMayAnswer({
        text: body,
        store: scopeStore,
        messages: earlier,
      }).catch(() => false))
    ) {
      await repo.update(conversation.id, {
        aiCursor: messageAt,
        unreadDelta: 1,
      });
      continue;
    }
    const previousTarget = touched.get(conversation.id);
    touched.set(conversation.id, {
      to: message.from,
      replyWithAudio:
        Boolean(message.loadAudio) || Boolean(previousTarget?.replyWithAudio),
    });
  }
  return async () => {
    if (!assistantActive) return;
    // Let short WhatsApp bursts arrive before one leased answer is generated.
    await new Promise((resolve) => setTimeout(resolve, whatsappBurstDelayMs));
    const { data: freshSettings } = await createSupabaseAdmin()
      .from("business_settings")
      .select("assistant_enabled,assistant_schedule_enabled,open_days,open_start,open_end")
      .eq("business_id", input.businessId)
      .maybeSingle();
    if (
      !globalAiEnabled ||
      !assistantAllowedNow(freshSettings as AssistantSettingsRow | null)
    )
      return;
    for (const [id, target] of touched) {
      const conversation = await repo.get(id);
      if (!conversation || conversation.status !== "ai") continue;
      await processConversation(repo, id, {
        origin: input.origin,
        slug,
        send: async (body, menu) => {
          let audio: Uint8Array | undefined;
          if (target.replyWithAudio) {
            try {
              audio = (await synthesizeWhatsAppReply(body)) || undefined;
            } catch (error) {
              console.error("StudioFlow voice reply error:", {
                code:
                  error instanceof Error &&
                  error.message.startsWith("elevenlabs-speech-")
                    ? error.message
                    : "elevenlabs-unavailable",
              });
            }
          }
          const messageId = await input.send(target.to, body, menu, audio);
          return messageId && input.professionalId
            ? `${input.professionalId}:${messageId}`
            : messageId;
        },
      });
    }
  };
}

/** A delivery from Meta for one business, already authenticated by the signature. */
export async function receiveWhatsApp(
  account: WhatsAppAccount,
  messages: import("./whatsapp").InboundMessage[],
  origin: string,
) {
  return receiveWhatsAppMessages({
    businessId: account.businessId,
    tenantId: account.tenantId,
    origin,
    messages: messages
      .filter(
        (message) =>
          !message.phoneNumberId ||
          message.phoneNumberId === account.phoneNumberId,
      )
      .map((message) => ({
        id: message.id,
        from: message.from,
        name: message.name,
        text: message.text,
        loadAudio: message.audioId
          ? () => downloadWhatsAppMedia(message.audioId!, account.token)
          : undefined,
        loadImage: message.imageId
          ? async () => {
              const media = await downloadWhatsAppMedia(
                message.imageId!,
                account.token,
              );
              return { image: media.audio, mime: media.mime };
            }
          : undefined,
      })),
    send: async (to, body, menu, audio) => {
      const messageId = await sendWhatsApp({
        phoneNumberId: account.phoneNumberId,
        token: account.token,
        to,
        body,
        menu,
      });
      if (audio) {
        try {
          await import("./whatsapp").then(({ sendWhatsAppAudio }) =>
            sendWhatsAppAudio({
              phoneNumberId: account.phoneNumberId,
              token: account.token,
              to,
              audio,
            }),
          );
        } catch (error) {
          console.error("StudioFlow voice reply error:", {
            code:
              error instanceof Error &&
              error.message.startsWith("elevenlabs-speech-")
                ? error.message
                : "whatsapp-audio-send-failed",
          });
        }
      }
      return messageId;
    },
  });
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

export async function instagramAccount(
  businessId: string,
): Promise<InstagramAccount | null> {
  const { data } = await createSupabaseAdmin()
    .from("instagram_accounts")
    .select(
      "business_id,tenant_id,ig_user_id,access_token_enc,app_secret_enc,verify_token_hash",
    )
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data) return null;
  return {
    businessId: data.business_id,
    tenantId: data.tenant_id,
    igUserId: data.ig_user_id,
    token: decryptSecret(data.access_token_enc),
    appSecret: decryptSecret(data.app_secret_enc),
    verifyTokenHash: Buffer.from(
      String(data.verify_token_hash).replace(/^\\x/, ""),
      "hex",
    ),
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
  if (!accessOpen(access) || !hasModule(access.modules, "recepcionista"))
    return async () => {};
  const repo = liveRepo(account.businessId, account.tenantId);
  const { data: settings } = await createSupabaseAdmin()
    .from("business_settings")
    .select("assistant_enabled,assistant_schedule_enabled,open_days,open_start,open_end")
    .eq("business_id", account.businessId)
    .maybeSingle();
  const globalAiEnabled = await platformAiEnabled();
  const assistantActive =
    globalAiEnabled && assistantAllowedNow(settings as AssistantSettingsRow | null);
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
      ? assistantActive
        ? await audioText(() => downloadUrl(message.audioUrl!))
        : "[Áudio recebido para atendimento manual]"
      : message.text;
    const messageAt = message.createdAt || new Date().toISOString();
    if (
      !(await repo.addMessage(
        conversation.id,
        "customer",
        body,
        message.id,
        messageAt,
      ))
    )
      continue;
    if (!assistantActive) {
      await repo.update(conversation.id, {
        aiCursor: messageAt,
        unreadDelta: 1,
      });
      continue;
    }
    if (conversation.status === "human" || conversation.status === "closed") {
      const cursor = cursorBefore(messageAt);
      await repo.update(conversation.id, {
        status: "ai",
        aiCursor: cursor,
        unread: 0,
      });
      conversation.status = "ai";
      conversation.aiCursor = cursor;
    }
    if (conversation.status !== "ai" || !assistantActive)
      await repo.update(conversation.id, { unreadDelta: 1 });
    touched.set(conversation.id, message.from);
  }
  return async () => {
    if (!assistantActive) return;
    for (const [id, to] of touched) {
      const conversation = await repo.get(id);
      if (!conversation || conversation.status !== "ai") continue;
      await processConversation(repo, id, {
        origin,
        slug,
        send: (body) =>
          sendInstagram({
            igUserId: account.igUserId,
            token: account.token,
            to,
            body,
          }),
      });
    }
  };
}
