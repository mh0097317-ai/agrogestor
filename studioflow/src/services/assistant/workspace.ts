import { randomBytes } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin, requireMembership } from "@/lib/supabase/server";
import type { ConversationMessage, ConversationSummary } from "@/types";
import { isDemo, mutateDemo, readDemo } from "../server-demo";
import { encryptSecret, sha256 } from "../server-secrets";
import { camel, demoWorkspaceSlug } from "../server-store";
import { demoRepo, instagramAccount, liveRepo } from "./conversations";
import { checkWhatsApp } from "./whatsapp";
import {
  checkInstagram,
  instagramTokenProblem,
  sendInstagram,
} from "./instagram";
import { conversationSender } from "../whatsapp/link";
import { resumeHistory } from "./agent";
import { recoverConversation } from "./recovery";
import { aiConfigured } from "../admin-vault";
import { analysisBlockReason } from "@/lib/conversation-analysis";
import { assertProfessionalChannel } from "@/lib/professional-scope";
import { whatsappDestination } from "@/lib/whatsapp-contacts";
import {
  realWhatsAppChat,
  realWhatsAppMessages,
  mirrorMessages,
} from "../whatsapp/history";

const editors = ["owner", "admin", "manager"];
const staff = [...editors, "receptionist", "professional"];

export const assistantSchema = z.object({
  assistantEnabled: z.boolean(),
  assistantName: z.string().trim().min(2, "Dê um nome à atendente.").max(40),
  assistantInstructions: z
    .string()
    .trim()
    .max(1500, "Use no máximo 1.500 caracteres."),
  assistantDailyLimit: z.number().int().min(10).max(5000),
});
export const whatsappSchema = z.object({
  phoneNumberId: z
    .string()
    .trim()
    .regex(/^\d{5,30}$/, "O ID do número tem só dígitos."),
  token: z
    .string()
    .trim()
    .min(20, "Cole o token de acesso completo.")
    .max(1000),
  appSecret: z.string().trim().min(16, "Cole a chave secreta do app.").max(200),
});
export const instagramSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, "Cole o token de acesso do Instagram completo.")
    .max(1000)
    .superRefine((value, ctx) => {
      const problem = instagramTokenProblem(value);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    }),
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
  z.object({ action: z.literal("retry") }),
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
    throw new DomainError(
      "Este número já está ligado a outro estabelecimento.",
      409,
    );
  if (error) throw new DomainError("Não foi possível salvar a conexão.", 503);
  // The verify token is shown once: Meta asks for it when the webhook is set.
  return {
    displayPhone,
    webhookUrl: `${origin}/api/whatsapp/${businessId}`,
    verifyToken,
  };
}

export async function connectInstagram(
  input: z.infer<typeof instagramSchema>,
  origin: string,
) {
  if (isDemo())
    throw new DomainError(
      "O Instagram funciona só no ambiente de produção.",
      400,
    );
  const { businessId } = await member(editors);
  const { igUserId, username } = await checkInstagram(input.token);
  const admin = createSupabaseAdmin();
  const { data: business } = await admin
    .from("businesses")
    .select("tenant_id")
    .eq("id", businessId)
    .single();
  const verifyToken = randomBytes(24).toString("base64url");
  const { error } = await admin.from("instagram_accounts").upsert({
    business_id: businessId,
    tenant_id: business!.tenant_id,
    ig_user_id: igUserId,
    username,
    access_token_enc: encryptSecret(input.token),
    app_secret_enc: encryptSecret(input.appSecret),
    verify_token_hash: `\\x${sha256(verifyToken).toString("hex")}`,
  });
  if (error?.code === "23505")
    throw new DomainError(
      "Esta conta do Instagram já está ligada a outro estabelecimento.",
      409,
    );
  if (error) throw new DomainError("Não foi possível salvar a conexão.", 503);
  return {
    username,
    webhookUrl: `${origin}/api/instagram/${businessId}`,
    verifyToken,
  };
}

export async function disconnectInstagram() {
  if (isDemo()) return { ok: true };
  const { businessId } = await member(editors);
  await createSupabaseAdmin()
    .from("instagram_accounts")
    .delete()
    .eq("business_id", businessId);
  return { ok: true };
}

export async function disconnectWhatsApp() {
  if (isDemo()) return { ok: true };
  const { businessId } = await member(editors);
  await createSupabaseAdmin()
    .from("whatsapp_accounts")
    .delete()
    .eq("business_id", businessId);
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
        latestRole: item.messages.filter((m) => m.role !== "event").at(-1)
          ?.role,
        latestMessageAt: item.messages.filter((m) => m.role !== "event").at(-1)
          ?.createdAt,
      }))
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }
  const { client, businessId } = await member();
  const { data, error } = await client
    .from("conversations")
    .select(
      "id,channel,contact_name,contact_phone,status,unread,last_message_at,whatsapp_professional_id",
    )
    .eq("business_id", businessId)
    .order("last_message_at", { ascending: false })
    .limit(60);
  if (error)
    throw new DomainError("Não foi possível carregar as conversas.", 503);
  const list = camel(data || []) as ConversationSummary[];
  if (!list.length) return list;
  const messagePages = await Promise.all(
    list.map((item) =>
      client
        .from("conversation_messages")
        .select("id,conversation_id,body,role,created_at,provider_message_id")
        .eq("business_id", businessId)
        .eq("conversation_id", item.id)
        .neq("role", "event")
        .order("created_at", { ascending: false })
        .limit(6),
    ),
  );
  if (messagePages.some((page) => page.error || !page.data))
    throw new DomainError("Não foi possível carregar as mensagens.", 503);
  const last = messagePages.flatMap((page) => page.data || []);
  // Only enrich IDs already authorized by conversation RLS, within this business.
  const { data: runs, error: runsError } = await createSupabaseAdmin()
    .from("assistant_runs")
    .select("conversation_id,state,cursor")
    .eq("business_id", businessId)
    .in(
      "conversation_id",
      list.map((item) => item.id),
    );
  if (runsError)
    throw new DomainError("Não foi possível consultar os atendimentos.", 503);
  for (const item of list) {
    const latest = last.find((row) => row.conversation_id === item.id);
    item.preview = latest?.body;
    item.latestRole = latest?.role;
    item.latestMessageAt = latest?.created_at;
    const run = runs?.find((row) => row.conversation_id === item.id);
    item.runState =
      run &&
      !(
        latest?.role === "customer" &&
        Date.parse(latest.created_at) > Date.parse(run.cursor) &&
        ["SENT", "SILENT", "FAILED"].includes(run.state)
      )
        ? run.state
        : null;
  }
  const verified = await Promise.all(
    list.map(async (item) => {
      if (!item.preview) return null;
      const ids = last
        .filter(
          (row) => row.conversation_id === item.id && row.provider_message_id,
        )
        .map((row) => row.provider_message_id as string);
      // An unavailable provider is not evidence of deletion. Keep the saved inbox.
      const chat = await realWhatsAppChat(businessId, item, ids).catch(
        () => undefined,
      );
      if (chat?.lastMessage) {
        const preview = mirrorMessages(
          [chat.lastMessage],
          camel(
            last.filter((row) => row.conversation_id === item.id),
          ) as (ConversationMessage & { providerMessageId?: string })[],
          chat.instance,
          item.contactPhone,
        ).at(-1);
        // Use the provider's latest message, including edits, instead of a deleted local preview.
        item.preview = preview?.body;
        item.latestRole = preview?.role;
        item.latestMessageAt = preview?.createdAt;
      }
      return chat === null ? null : item;
    }),
  );
  return verified.filter((item): item is ConversationSummary => !!item);
}

export async function conversationDetail(id: string) {
  if (isDemo()) {
    const slug = await demoWorkspaceSlug();
    const store = await readDemo(slug);
    const repo = demoRepo(slug, store.business.id);
    const conversation = await repo.get(id);
    if (!conversation) throw new DomainError("Conversa não encontrada.", 404);
    await repo.update(id, { unread: 0 });
    return {
      conversation: { ...conversation, history: undefined },
      messages: await repo.messages(id),
    };
  }
  const { client, businessId, role } = await member();
  const { data } = await client
    .from("conversations")
    .select(
      "id,channel,contact_name,contact_phone,status,unread,last_message_at,whatsapp_professional_id,processing_until",
    )
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new DomainError("Conversa não encontrada.", 404);
  const { data: messages, error: messageError } = await client
    .from("conversation_messages")
    .select("id,role,body,created_at,provider_message_id")
    .eq("conversation_id", id)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (messageError)
    throw new DomainError("Não foi possível ler o histórico.", 503);
  if (staff.includes(role) && data.unread)
    await createSupabaseAdmin()
      .from("conversations")
      .update({ unread: 0 })
      .eq("id", id);
  const { data: run, error: runError } = await createSupabaseAdmin()
    .from("assistant_runs")
    .select("state,error_code,attempts,retry_at,updated_at,cursor")
    .eq("business_id", businessId)
    .eq("conversation_id", id)
    .maybeSingle();
  if (runError)
    throw new DomainError("Não foi possível consultar o atendimento.", 503);
  let transcript = camel((messages || []).reverse()) as (ConversationMessage & {
    providerMessageId?: string;
  })[];
  let syncUnavailable = false;
  if (data.channel === "whatsapp") {
    try {
      const chat = await realWhatsAppChat(
        businessId,
        camel(data) as ConversationSummary,
        transcript
          .map((message) => message.providerMessageId || "")
          .filter(Boolean)
          .reverse(),
      );
      if (chat !== undefined)
        transcript = [
          ...transcript.filter((message) => message.role === "event"),
          ...(chat
            ? await realWhatsAppMessages(chat, transcript, data.contact_phone)
            : []),
        ];
    } catch {
      syncUnavailable = true;
    }
  }
  const latest = transcript
    .filter((message) => message.role !== "event")
    .at(-1);
  const newerRequest =
    run &&
    latest?.role === "customer" &&
    Date.parse(latest.createdAt) > Date.parse(run.cursor);
  return {
    conversation: camel(data) as ConversationSummary,
    messages: transcript,
    syncUnavailable,
    run:
      newerRequest && ["SENT", "SILENT", "FAILED"].includes(run.state)
        ? null
        : run,
    analysis: {
      reason: analysisBlockReason({
        channel: data.channel,
        messages: transcript,
        run,
        processingUntil: data.processing_until,
      }),
    },
  };
}

export async function conversationAction(
  id: string,
  input: z.infer<typeof conversationActionSchema>,
  origin = "",
) {
  const demo = isDemo();
  let repo;
  let businessId: string | undefined;
  let instagram: Awaited<ReturnType<typeof instagramAccount>> = null;
  if (demo) {
    const slug = await demoWorkspaceSlug();
    const store = await readDemo(slug);
    repo = demoRepo(slug, store.business.id);
  } else {
    const membership = await member(staff);
    businessId = membership.businessId;
    // The mutation repository uses service_role: verify the channel before using it.
    const { data: authorized } = await membership.client
      .from("conversations")
      .select("whatsapp_professional_id")
      .eq("business_id", businessId)
      .eq("id", id)
      .maybeSingle();
    if (!authorized) throw new DomainError("Conversa não encontrada.", 404);
    assertProfessionalChannel(membership, authorized.whatsapp_professional_id);
    const { data: business } = await createSupabaseAdmin()
      .from("businesses")
      .select("tenant_id")
      .eq("id", businessId)
      .single();
    repo = liveRepo(businessId, business!.tenant_id);
    instagram = await instagramAccount(businessId).catch(() => null);
  }
  const conversation = await repo.get(id);
  if (!conversation) throw new DomainError("Conversa não encontrada.", 404);
  if (input.action === "retry") {
    if (demo)
      throw new DomainError(
        "A análise pelo WhatsApp está disponível no ambiente publicado.",
        409,
      );
    const reason = analysisBlockReason({
      channel: conversation.channel,
      messages: await repo.messages(id),
      run: await repo.run?.(id),
      processingUntil: conversation.processingUntil,
    });
    if (reason) throw new DomainError(reason, 409);
    if (!(await aiConfigured(businessId!)))
      throw new DomainError(
        "Cadastre a chave de IA deste estabelecimento no cofre antes de analisar.",
        409,
      );
    if (
      !(await conversationSender(
        businessId!,
        conversation.whatsappProfessionalId,
      ))
    )
      throw new DomainError(
        "Conecte o WhatsApp usado nesta conversa antes de analisar e responder.",
        409,
      );
    const admin = createSupabaseAdmin();
    const { data: business, error: businessError } = await admin
      .from("businesses")
      .select("tenant_id,slug")
      .eq("id", businessId!)
      .single();
    if (businessError || !business)
      throw new DomainError(
        "Não foi possível consultar o estabelecimento.",
        503,
      );
    const { data: result, error } = await admin.rpc(
      "request_assistant_analysis",
      {
        p_business_id: businessId!,
        p_id: id,
      },
    );
    if (error)
      throw new DomainError(
        "Não foi possível iniciar a análise. Tente novamente.",
        503,
      );
    const problems: Record<string, string> = {
      "not-found": "Conversa não encontrada.",
      "not-whatsapp": "Disponível nas conversas de WhatsApp.",
      "delivery-unconfirmed":
        "Confira a entrega no WhatsApp antes de tentar novamente.",
      busy: "A análise já está em andamento. Aguarde o resultado.",
      answered: "Não há mensagem do cliente aguardando resposta.",
      expired:
        "A última mensagem tem mais de 24 horas. Aguarde um novo contato.",
      "appointment-created":
        "Este pedido já gerou um agendamento. Confira a agenda e confirme ao cliente, sem criar outro horário.",
      disabled:
        "Ative o atendimento do StudioFlow nas configurações antes de analisar.",
      "daily-limit":
        "O limite diário de atendimento foi atingido. Aguarde a renovação ou ajuste o limite nas configurações.",
    };
    if (result !== "queued")
      throw new DomainError(
        problems[String(result)] || "Não foi possível iniciar a análise.",
        409,
      );
    return {
      ok: true,
      notice:
        "Análise solicitada. StudioFlow vai ler as últimas seis mensagens e o pedido pendente. Assuntos pessoais continuam sem resposta automática.",
      work: () =>
        recoverConversation({
          id,
          businessId: businessId!,
          tenantId: business!.tenant_id,
          slug: business!.slug,
          origin,
        }),
    };
  }
  if (input.action === "status") {
    await repo.update(id, {
      status: input.status,
      unread: 0,
      // Resume with future messages, without replaying requests handled by the team.
      ...(input.status === "ai"
        ? {
            history: resumeHistory(
              conversation.history,
              await repo.messages(id, conversation.aiCursor),
            ),
            aiCursor: new Date().toISOString(),
          }
        : {}),
    });
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
  let providerId: string | void = undefined;
  if (conversation.channel === "whatsapp" && !demo) {
    const send = await conversationSender(
      businessId!,
      conversation.whatsappProfessionalId,
    );
    if (!send)
      throw new DomainError(
        "Conecte o WhatsApp da loja para responder por ele.",
        409,
      );
    providerId = await send(whatsappDestination(conversation), input.body);
    if (providerId && conversation.whatsappProfessionalId)
      providerId = `${conversation.whatsappProfessionalId}:${providerId}`;
  }
  if (conversation.channel === "instagram" && !demo) {
    if (!instagram || !conversation.contactRef)
      throw new DomainError("Conecte o Instagram para responder por ele.", 409);
    await sendInstagram({
      igUserId: instagram.igUserId,
      token: instagram.token,
      to: conversation.contactRef,
      body: input.body,
    });
  }
  await repo.addMessage(id, "staff", input.body, providerId || undefined);
  // Whoever answers takes the conversation; the AI waits until it is handed back.
  if (conversation.status !== "human")
    await repo.update(id, { status: "human", unread: 0 });
  return { ok: true };
}
