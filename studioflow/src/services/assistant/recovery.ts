import { createSupabaseAdmin, readBusinessAccess } from "@/lib/supabase/server";
import { accessOpen } from "@/lib/access";
import { hasModule } from "@/lib/modules";
import { conversationSender } from "../whatsapp/link";
import { liveRepo, processConversation } from "./conversations";
import { whatsappDestination } from "@/lib/whatsapp-contacts";
import { platformAiEnabled } from "../platform-ai-control";
import { recordError } from "../error-log";
import { alertOwner } from "./alerts";

export async function recoverConversation(input: {
  id: string;
  businessId: string;
  tenantId: string;
  slug: string;
  origin: string;
}) {
  if (!(await platformAiEnabled())) return;
  const access = await readBusinessAccess(input.businessId);
  if (!accessOpen(access) || !hasModule(access.modules, "recepcionista"))
    return;
  const { data: settings } = await createSupabaseAdmin()
    .from("business_settings")
    .select("assistant_enabled")
    .eq("business_id", input.businessId)
    .maybeSingle();
  if (!settings?.assistant_enabled) return;
  const repo = liveRepo(input.businessId, input.tenantId);
  const conversation = await repo.get(input.id);
  if (
    !conversation ||
    conversation.status !== "ai" ||
    conversation.channel !== "whatsapp"
  )
    return;
  const send = await conversationSender(
    input.businessId,
    conversation.whatsappProfessionalId,
    "assistant",
  );
  if (!send) return; // No outgoing connection: keep pending for the next scan.
  await processConversation(repo, input.id, {
    slug: input.slug,
    origin: input.origin,
    send: (body,menu) => send(whatsappDestination(conversation), body,menu),
  });
}

export async function recoverPendingConversations(origin: string) {
  if (!(await platformAiEnabled())) return { checked: 0, failed: 0, stale: 0 };
  const { data, error } = await createSupabaseAdmin().rpc(
    "due_assistant_conversations",
  );
  if (error) throw new Error("recovery-scan-unavailable");
  const stale = await closeStaleRuns().catch(() => 0);
  const results = await Promise.allSettled(
    (data || []).map(
      (row: {
        id: string;
        business_id: string;
        tenant_id: string;
        slug: string;
      }) =>
        recoverConversation({
          id: row.id,
          businessId: row.business_id,
          tenantId: row.tenant_id,
          slug: row.slug,
          origin,
        }),
    ),
  );
  return {
    checked: results.length,
    failed: results.filter((r) => r.status === "rejected").length,
    stale,
  };
}

export interface StaleRun {
  conversation_id: string;
  business_id: string;
  tenant_id: string;
  state: string;
  attempts: number;
  run_updated_at: string;
  conversation_status: string;
  channel: string;
  contact_phone: string | null;
  answered: boolean;
}

/** O que fazer com um atendimento que parou no meio. */
export function staleOutcome(run: StaleRun, now = new Date()) {
  // A equipe (ou a própria IA, numa rodada seguinte) já respondeu: só fecha.
  if (run.answered) return { state: "SILENT" as const, alert: false, note: null };
  const recent = now.getTime() - Date.parse(run.run_updated_at) < 86_400_000;
  return {
    state: "FAILED" as const,
    errorCode: run.state === "SENDING" ? "delivery-unconfirmed" : "stale",
    // Aviso só do que ainda dá para salvar; caso antigo fica no histórico.
    alert: recent && run.channel === "whatsapp",
    note:
      run.state === "SENDING"
        ? "A atendente virtual parou no envio e não confirmou se a mensagem saiu. Confira o WhatsApp antes de responder. A conversa está com a equipe."
        : "A atendente virtual não terminou de responder. A conversa está com a equipe.",
  };
}

/**
 * Fecha os atendimentos travados que a recuperação não vai retomar: o
 * cliente não fica esperando em silêncio e o dono fica sabendo.
 */
export async function closeStaleRuns(now = new Date()) {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc("stale_assistant_runs");
  if (error) throw new Error("stale-scan-unavailable");
  let closed = 0;
  for (const run of (data || []) as StaleRun[]) {
    const outcome = staleOutcome(run, now);
    const repo = liveRepo(run.business_id, run.tenant_id);
    try {
      await repo.progress?.(run.conversation_id, {
        state: outcome.state,
        ...(outcome.state === "FAILED" ? { errorCode: outcome.errorCode } : {}),
      });
      closed++;
      if (outcome.state === "SILENT") continue;
      if (run.conversation_status === "ai")
        await repo.update(run.conversation_id, { status: "human", unreadDelta: 1 });
      else await repo.update(run.conversation_id, { unreadDelta: 1 });
      if (outcome.note)
        await repo.addMessage(run.conversation_id, "event", outcome.note);
      await recordError("assistant", outcome.errorCode, {
        businessId: run.business_id,
        detail: { stage: run.state, attempts: run.attempts },
      });
      if (outcome.alert)
        await alertOwner({
          businessId: run.business_id,
          kind: "failed",
          conversationId: run.conversation_id,
          phone: run.contact_phone || "",
        });
    } catch {
      // Banco indisponível: a próxima varredura tenta de novo.
    }
  }
  return closed;
}
