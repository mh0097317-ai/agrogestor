import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { aiCosts, saveAiBudget, saveUsdBrl, usdBrlRate } from "@/services/assistant/cost";
import { requirePlatformAdmin } from "@/services/platform";
import { isDemo } from "@/services/server-demo";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
import { DomainError } from "@/lib/availability";

export const dynamic = "force-dynamic";

/** Consumo de IA do mês por casa, com estimativa em reais e teto. */
export async function GET() {
  try {
    await requirePlatformAdmin();
    if (isDemo()) return respond({ rate: null, items: [], demo: true });
    const [items, rate, names] = await Promise.all([
      aiCosts(),
      usdBrlRate(),
      createSupabaseAdmin().from("businesses").select("id,name"),
    ]);
    const nameOf = new Map((names.data || []).map((b) => [b.id as string, b.name as string]));
    return respond({
      rate,
      items: items
        .map((item) => ({ ...item, businessName: nameOf.get(item.businessId) || "—" }))
        .sort((a, b) => b.usd - a.usd),
    });
  } catch (e) {
    return failure(e);
  }
}

const updateSchema = z.union([
  z.object({ rate: z.number().min(1).max(50).nullable() }),
  z.object({
    businessId: z.string().uuid(),
    budgetCents: z.number().int().min(0).max(100_000_000).nullable(),
  }),
]);

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const { userId } = await requirePlatformAdmin();
    if (isDemo()) throw new DomainError("Disponível só no ambiente publicado.", 409);
    const input = updateSchema.parse(await request.json());
    if ("rate" in input) await saveUsdBrl(userId, input.rate);
    else await saveAiBudget(input.businessId, userId, input.budgetCents);
    return respond({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
