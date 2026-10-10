import { getWorkspace } from "./server-store";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { DomainError } from "@/lib/availability";
import { n8nWhatsAppConfiguration } from "./assistant/n8n-whatsapp";
import { businessDay } from "@/lib/utils";
import type { OperationSnapshot } from "@/lib/operation-health";

export async function operationSnapshot(): Promise<OperationSnapshot> {
  const store = await getWorkspace();
  if (!["owner", "admin", "manager"].includes(store.viewer?.role || ""))
    throw new DomainError(
      "Somente a gestão pode consultar a operação e o consumo.",
      403,
    );
  const checkedAt = new Date().toISOString();
  const result: OperationSnapshot = {
    businessId: store.business.id,
    checkedAt,
    runs: [],
    notifications: [],
    usage: [],
    n8nConfigured: false,
    configurationError: false,
    demo: store.mode === "demo",
  };
  try {
    result.n8nConfigured = [
      null,
      ...store.professionals.filter((p) => p.active).map((p) => p.id),
    ].some((id) => !!n8nWhatsAppConfiguration(store.business.id, id));
  } catch {
    result.configurationError = true;
  }
  if (result.demo) return result;
  const admin = createSupabaseAdmin();
  const from = businessDay(new Date(Date.now() - 29 * 86400000));
  const [runs, receipts, usage, notices] = await Promise.all([
    admin
      .from("assistant_runs")
      .select("state,error_code,updated_at")
      .eq("business_id", store.business.id)
      .order("updated_at", { ascending: false })
      .limit(20),
    admin
      .from("n8n_notification_receipts")
      .select("status,kind,created_at")
      .eq("business_id", store.business.id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("assistant_usage")
      .select("day,turns,input_tokens,output_tokens")
      .eq("business_id", store.business.id)
      .gte("day", from)
      .lte("day", businessDay())
      .order("day", { ascending: false }),
    admin
      .from("appointment_whatsapp_notices")
      .select("status,kind,created_at")
      .eq("business_id", store.business.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (runs.error || receipts.error || usage.error || notices.error)
    throw new DomainError(
      "Não foi possível verificar a operação. Os dados não foram substituídos por zeros.",
      503,
    );
  result.runs = (runs.data || []).map((row) => ({
    state: row.state,
    errorCode: /^[a-z-]{1,60}$/.test(row.error_code || "")
      ? row.error_code
      : null,
    at: row.updated_at,
  }));
  result.notifications = [...(receipts.data || []), ...(notices.data || [])]
    .map((row) => ({
      status: row.status,
      kind: row.kind,
      at: row.created_at,
    }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 20);
  result.usage = (usage.data || []).map((row) => ({
    day: row.day,
    turns: Number(row.turns),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
  }));
  return result;
}
