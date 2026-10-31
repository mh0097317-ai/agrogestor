import { appUrl } from "@/lib/app-url";
import { hasModule } from "@/lib/modules";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isDemo } from "../server-demo";
import { getPublicStore } from "../server-store";
import { demoSlugs } from "../platform";
import { platformAiEnabled } from "../platform-ai-control";
import { brandEmail } from "../email/brand-email";
import { emailConfigured, sendEmail } from "../email/resend";
import { businessCreate } from "./provider";
import { receptionistModel } from "./receptionist";
import { runReceptionistEval } from "./receptionist-eval";

/*
 * Toda madrugada as conversas de teste rodam de novo em cada loja com a
 * recepcionista ligada, com a chave da própria loja e numa cópia da agenda
 * em memória. Uma loja por rodada do cron (a cada 5 min, das 3h às 4h de
 * Brasília), no máximo uma vez por dia. Se alguma conversa falhar, a equipe
 * StudioFlow recebe um e-mail. STUDIOFLOW_NIGHTLY_EVAL=off desliga.
 */

/** 3h–4h in Brasília (UTC-3, no daylight saving). */
export const nightlyWindow = (now = new Date()) => now.getUTCHours() === 6;

async function platformEmails() {
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("platform_admins").select("user_id");
  const emails = await Promise.all(
    (data || []).map(async (row) => {
      const user = await admin.auth.admin.getUserById(row.user_id as string);
      return user.data.user?.email || "";
    }),
  );
  return [...new Set(emails.filter(Boolean))];
}

/** Next shop due for its nightly test, already claimed; null when none. */
async function nextShop(now: Date) {
  const admin = createSupabaseAdmin();
  const { data: enabled } = await admin
    .from("business_settings")
    .select("business_id,businesses!inner(slug,name)")
    .eq("assistant_enabled", true);
  const demos = new Set(await demoSlugs());
  const since = new Date(now.getTime() - 20 * 3_600_000).toISOString();
  for (const row of (enabled || []) as unknown as {
    business_id: string;
    businesses: { slug: string; name: string };
  }[]) {
    if (demos.has(row.businesses.slug)) continue;
    const { count } = await admin
      .from("assistant_eval_runs")
      .select("id", { count: "exact", head: true })
      .eq("business_id", row.business_id)
      .is("created_by", null)
      .gte("created_at", since);
    if (count) continue;
    const store = await getPublicStore(row.businesses.slug).catch(() => null);
    if (!store || !hasModule(store.access?.modules, "recepcionista")) continue;
    const create = await businessCreate(row.business_id, receptionistModel);
    if (!create) continue;
    // Claimed before running, so the next tick picks another shop.
    const { data: run, error } = await admin
      .from("assistant_eval_runs")
      .insert({
        business_id: row.business_id,
        model: receptionistModel,
        passed: 0,
        total: 0,
        results: [],
      })
      .select("id")
      .single();
    if (error) return null;
    return { store, create, runId: run.id as string };
  }
  return null;
}

/** Cron: one shop's nightly test conversations. Never throws. */
export async function runNightlyEval(now = new Date()) {
  if (
    process.env.STUDIOFLOW_NIGHTLY_EVAL === "off" ||
    isDemo() ||
    !nightlyWindow(now) ||
    !(await platformAiEnabled())
  )
    return "skipped" as const;
  const shop = await nextShop(now);
  if (!shop) return "skipped" as const;
  const admin = createSupabaseAdmin();
  const results = await runReceptionistEval(shop.store, shop.create, {
    concurrency: 6,
  }).catch((error) => [
    {
      name: "Rodada",
      ok: false,
      problems: [
        `erro: ${error instanceof Error ? error.message.slice(0, 160) : "desconhecido"}`,
      ],
      turns: [],
    },
  ]);
  const passed = results.filter((r) => r.ok).length;
  await admin
    .from("assistant_eval_runs")
    .update({ passed, total: results.length, results })
    .eq("id", shop.runId);
  const failed = results.filter((r) => !r.ok);
  if (failed.length && (await emailConfigured())) {
    const name = shop.store.business.name;
    const emails = await platformEmails();
    for (const [i, to] of emails.entries())
      await sendEmail(
        brandEmail({
          to,
          subject: `Teste da madrugada: ${failed.length} conversa(s) da ${name} falharam`,
          preview: `${passed} de ${results.length} conversas certas na ${name}.`,
          title: "A recepcionista errou no teste",
          paragraphs: [
            `${passed} de ${results.length} conversas certas na ${name}.`,
            ...failed
              .slice(0, 8)
              .map((r) => `${r.name}: ${r.problems.join(" · ")}`),
          ],
          cta: { label: "Ver as conversas", url: `${appUrl}/admin` },
        }),
        `nightly-eval-${shop.runId}-${i}`,
      ).catch(() => undefined);
  }
  return { slug: shop.store.business.slug, passed, total: results.length };
}
