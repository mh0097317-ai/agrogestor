import { createSupabaseAdmin } from "@/lib/supabase/server";
import { readinessFromEnv } from "@/lib/platform-readiness";
import { evolutionConfigView } from "./admin-vault";
import { outboundMode } from "./outbound-guard";
import { requirePlatformAdmin } from "./platform";
import { isDemo } from "./server-demo";

export async function platformReadiness() {
  await requirePlatformAdmin();
  let evolution = false;
  let aiVaultKeys = 0;
  try {
    evolution = (await evolutionConfigView()).configured;
  } catch {
    evolution = false;
  }
  if (!isDemo()) {
    const { count } = await createSupabaseAdmin()
      .from("business_ai_credentials")
      .select("business_id", { count: "exact", head: true });
    aiVaultKeys = count || 0;
  }
  return {
    checkedAt: new Date().toISOString(),
    items: readinessFromEnv(process.env, {
      evolution,
      aiVaultKeys,
      outboundMode: outboundMode(),
    }),
  };
}
