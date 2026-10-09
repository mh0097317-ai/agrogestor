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
import { notifyNewBooking } from "../whatsapp/notify";
import { bookWithPayments, getPaymentAccount } from "../server-payments";
import { decryptSecret, newToken, sha256 } from "../server-secrets";
import { camel, getPublicStore } from "../server-store";
import { accessOpen } from "@/lib/access";
import { hasModule } from "@/lib/modules";
import { runAssistant, resumeHistory, type CreateMessage } from "./agent";
import { businessCreate } from "./provider";
import { sendWhatsApp } from "./whatsapp";
import { sendInstagram, type InstagramMessage } from "./instagram";
import { audioText, downloadUrl, downloadWhatsAppMedia } from "./transcribe";
import {
  contextText,
  conversationContext,
  customerBookingContext,
  referencesPreviousBooking,
  vagueBookingRequest,
  understandMessage,
  personalSubject,
  hasBusinessSubject,
  canUnderstand,
  nameAnswer,
} from "./understanding";
import { failureCode, retryable, type RunProgress } from "./pipeline";
import { professionalStore } from "./agent";
import { n8nWhatsAppTurn } from "./n8n-whatsapp-contract";
import {
  n8nWhatsAppConfiguration,
  requestN8nTurn,
  N8nTurnError,
} from "./n8n-whatsapp";
import { verifiedN8nReply } from "./n8n-reply";

type History = Anthropic.Beta.BetaMessageParam[];
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
    "id,channel,contact_phone,contact_name,contact_ref,status,unread,history,ai_cursor,whatsapp_professional_id,processing_until";
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
  send?: (body: string) => Promise<string | void>;
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
  const scopedStore = professionalStore(
    store,
    conversation.whatsappProfessionalId || undefined,
  );
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
  if (
    conversation.channel === "whatsapp" &&
    !canUnderstand(
      text.replace(/^🎤\s*/, ""),
      scopedStore,
      recent,
      pending[0].createdAt,
      bookingContext,
    )
  ) {
    await repo.startRun?.(conversationId, cursor);
    await repo.update(conversationId, { aiCursor: cursor });
    await repo.progress?.(conversationId, { state: "SILENT" });
    return null;
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
  if (n8n && understanding) {
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
        professionalStore(
          freshStore,
          conversation.whatsappProfessionalId || undefined,
        ),
        text,
      );
      if ((await repo.get(conversationId))?.status !== "ai") return null;
      const handoff = proposed.handoff || verified.handoff;
      let sentId = await delivery.send?.(verified.reply);
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
  const result = await runAssistant({
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
    ctx: {
      channel: conversation.channel,
      professionalId: conversation.whatsappProfessionalId || undefined,
      customerName:
        store.customers.find(
          (customer) =>
            customer.phone
              .replace(/\D/g, "")
              .replace(/^55(?=\d{10,11}$)/, "") === conversation.contactPhone,
        )?.name || nameAnswer(text, recent),
      verifiedPhone:
        conversation.channel === "whatsapp"
          ? conversation.contactPhone
          : undefined,
      origin: delivery.origin,
      payments,
      loadStore: () => loadStore(delivery.slug),
      book: async (input) => {
        if ((await repo.get(conversationId))?.status !== "ai")
          throw new DomainError("A equipe assumiu esta conversa.", 409);
        const appointment = await bookWithPayments(
          delivery.slug,
          {
            serviceIds: input.serviceIds,
            professionalId: input.professionalId,
            start: input.start,
            name: input.name,
            phone: input.phone,
            email: "",
            reminder: true,
            cpf: input.cpf,
          },
          conversation.channel === "web" ? "public_link" : "receptionist",
          {
            channel: conversation.channel,
            conversationId: conversation.id,
          },
        );
        await notifyNewBooking(delivery.slug, appointment.id, delivery.origin);
        return appointment;
      },
    },
  });
  // A person may take over while the provider is generating a response.
  // Keep their control and charge the actual usage without publishing that reply.
  await repo.addTokens(result.usage.input, result.usage.output);
  if ((await repo.get(conversationId))?.status !== "ai") return null;
  let sentId: string | void = undefined;
  if (result.reply && delivery.send) {
    if (understanding)
      await repo.progress?.(conversationId, { state: "SENDING" });
    sentId = await delivery.send(result.reply);
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
  send: (to: string, body: string) => Promise<string | void>;
}) {
  const slug = await slugOf(input.businessId);
  // Sem acesso liberado ou sem a recepcionista no plano: a mensagem não é tratada.
  const access = await readBusinessAccess(input.businessId);
  if (!accessOpen(access) || !hasModule(access.modules, "recepcionista"))
    return async () => {};
  const repo = liveRepo(input.businessId, input.tenantId);
  const { data: settings } = await createSupabaseAdmin()
    .from("business_settings")
    .select("assistant_enabled")
    .eq("business_id", input.businessId)
    .maybeSingle();
  const { brazilPhone } = await import("./whatsapp");
  // Reply to the exact number WhatsApp used (it may lack the 9 of new numbers).
  const touched = new Map<string, string>();
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
          message.text,
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
    const body = message.loadAudio
      ? await audioText(message.loadAudio, input.businessId)
      : message.text;
    if (!existing) {
      const { data: customer, error } = await createSupabaseAdmin()
        .from("customers")
        .select("id")
        .eq("business_id", input.businessId)
        .in("phone", [phone, `55${phone}`])
        .limit(1);
      if (error) continue; // Fail closed: do not answer an unverified contact.
      if (!customer?.length) {
        if (
          !settings?.assistant_enabled ||
          personalSubject(body) ||
          /^\[O cliente enviou/.test(body)
        )
          continue;
        const catalog = await loadStore(slug);
        if (!hasBusinessSubject(body, catalog)) continue;
      }
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
    if (conversation.status === "closed")
      await repo.update(conversation.id, {
        status: settings?.assistant_enabled ? "ai" : "human",
      });
    if (conversation.status !== "ai" || !settings?.assistant_enabled)
      await repo.update(conversation.id, { unreadDelta: 1 });
    touched.set(conversation.id, message.from);
  }
  return async () => {
    if (!settings?.assistant_enabled) return;
    // Let short WhatsApp bursts arrive before one leased answer is generated.
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const { data: freshSettings } = await createSupabaseAdmin()
      .from("business_settings")
      .select("assistant_enabled")
      .eq("business_id", input.businessId)
      .maybeSingle();
    if (freshSettings?.assistant_enabled !== true) return;
    for (const [id, to] of touched) {
      const conversation = await repo.get(id);
      if (!conversation || conversation.status !== "ai") continue;
      await processConversation(repo, id, {
        origin: input.origin,
        slug,
        send: async (body) => {
          const id = await input.send(to, body);
          return id && input.professionalId
            ? `${input.professionalId}:${id}`
            : id;
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
      })),
    send: (to, body) =>
      sendWhatsApp({
        phoneNumberId: account.phoneNumberId,
        token: account.token,
        to,
        body,
      }),
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
    if (!(await repo.addMessage(conversation.id, "customer", body, message.id)))
      continue;
    if (conversation.status === "closed")
      await repo.update(conversation.id, {
        status: settings?.assistant_enabled ? "ai" : "human",
      });
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
