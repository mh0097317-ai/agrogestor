import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/services/platform";
import { getPublicStore } from "@/services/server-store";
import { businessCreate } from "@/services/assistant/provider";
import { receptionistModel } from "@/services/assistant/receptionist";
import { runReceptionistEval } from "@/services/assistant/receptionist-eval";
import { receptionistPreflight } from "@/services/assistant/preflight";
import {
  assertSameOrigin,
  failure,
  limitPublicMutation,
  respond,
} from "@/services/server-http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const input = z.object({ slug: z.string().min(1).max(120) }).strict();
const action = z
  .object({
    slug: z.string().min(1).max(120),
    action: z.enum(["test", "preflight"]).default("test"),
  })
  .strict();

/** Last test runs of a shop's receptionist and how it did, day by day. */
export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const slug = new URL(request.url).searchParams.get("slug") || "";
    const store = await getPublicStore(input.parse({ slug }).slug);
    const admin = createSupabaseAdmin();
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [{ data, error }, health, errors] = await Promise.all([
      admin
        .from("assistant_eval_runs")
        .select("id,model,passed,total,results,created_at,created_by")
        .eq("business_id", store.business.id)
        .order("created_at", { ascending: false })
        .limit(5),
      admin.rpc("assistant_health", { p_business: store.business.id }),
      // This shop's errors and the platform's own (cron), last 7 days.
      admin
        .from("app_errors")
        .select("scope,code,detail,created_at")
        .or(`business_id.eq.${store.business.id},business_id.is.null`)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    if (error) throw new DomainError("Não foi possível ler os testes.", 503);
    return respond({
      runs: data || [],
      health: health.data || [],
      errors: errors.data || [],
    });
  } catch (e) {
    return failure(e);
  }
}

/**
 * Runs the test conversations with the real model and the shop's own key,
 * on an in-memory copy of its agenda: nothing is booked, nothing is sent.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    limitPublicMutation(request, { scope: "assistant-eval", max: 6 });
    const { userId } = await requirePlatformAdmin();
    const { slug, action: kind } = action.parse(await request.json());
    if (kind === "preflight") return respond(await receptionistPreflight(slug));
    const store = await getPublicStore(slug);
    const create = await businessCreate(store.business.id, receptionistModel);
    if (!create)
      throw new DomainError("Esta loja não tem chave de IA configurada.", 409);
    const results = await runReceptionistEval(store, create);
    const passed = results.filter((r) => r.ok).length;
    const { error } = await createSupabaseAdmin()
      .from("assistant_eval_runs")
      .insert({
        business_id: store.business.id,
        model: receptionistModel,
        passed,
        total: results.length,
        results,
        created_by: userId,
      });
    if (error) console.error("StudioFlow eval save failed");
    return respond({ passed, total: results.length, results });
  } catch (e) {
    return failure(e);
  }
}
