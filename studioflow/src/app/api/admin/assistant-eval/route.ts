import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/services/platform";
import { getPublicStore } from "@/services/server-store";
import { businessCreate } from "@/services/assistant/provider";
import { receptionistModel } from "@/services/assistant/receptionist";
import { runReceptionistEval } from "@/services/assistant/receptionist-eval";
import {
  assertSameOrigin,
  failure,
  limitPublicMutation,
  respond,
} from "@/services/server-http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const input = z.object({ slug: z.string().min(1).max(120) }).strict();

/** Last test runs of a shop's receptionist and how it did, day by day. */
export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const slug = new URL(request.url).searchParams.get("slug") || "";
    const store = await getPublicStore(input.parse({ slug }).slug);
    const admin = createSupabaseAdmin();
    const [{ data, error }, health] = await Promise.all([
      admin
        .from("assistant_eval_runs")
        .select("id,model,passed,total,results,created_at")
        .eq("business_id", store.business.id)
        .order("created_at", { ascending: false })
        .limit(5),
      admin.rpc("assistant_health", { p_business: store.business.id }),
    ]);
    if (error) throw new DomainError("Não foi possível ler os testes.", 503);
    return respond({ runs: data || [], health: health.data || [] });
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
    const { slug } = input.parse(await request.json());
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
