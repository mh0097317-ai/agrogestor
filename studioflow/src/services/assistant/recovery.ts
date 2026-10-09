import { createSupabaseAdmin, readBusinessAccess } from "@/lib/supabase/server";
import { accessOpen } from "@/lib/access";
import { hasModule } from "@/lib/modules";
import { conversationSender } from "../whatsapp/link";
import { liveRepo, processConversation } from "./conversations";
import { whatsappDestination } from "@/lib/whatsapp-contacts";

export async function recoverConversation(input: {
  id: string;
  businessId: string;
  tenantId: string;
  slug: string;
  origin: string;
}) {
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
    send: (body) => send(whatsappDestination(conversation), body),
  });
}

export async function recoverPendingConversations(origin: string) {
  const { data, error } = await createSupabaseAdmin().rpc(
    "due_assistant_conversations",
  );
  if (error) throw new Error("recovery-scan-unavailable");
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
  };
}
