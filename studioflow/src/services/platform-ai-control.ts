import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { DomainError } from "@/lib/availability";
import { requirePlatformAdmin } from "./platform";
import { isDemo } from "./server-demo";

export const platformAiSchema = z.object({ enabled: z.boolean() }).strict();

/** No cache: a stopped platform must not continue sending generated replies. */
export async function platformAiEnabled(): Promise<boolean> {
  if (isDemo()) return true; // Local simulation cannot send real messages.
  try {
    const { data, error } = await createSupabaseAdmin()
      .from("platform_ai_control")
      .select("enabled")
      .eq("id", true)
      .maybeSingle();
    return !error && data?.enabled === true;
  } catch {
    return false;
  }
}

export async function platformAiControl(input?: unknown) {
  const { userId } = await requirePlatformAdmin();
  if (isDemo()) {
    if (input !== undefined)
      throw new DomainError(
        "O controle da IA funciona no ambiente publicado.",
        409,
      );
    return { enabled: false };
  }
  const admin = createSupabaseAdmin();
  if (input !== undefined) {
    const { enabled } = platformAiSchema.parse(input);
    const { error } = await admin.from("platform_ai_control").upsert({
      id: true,
      enabled,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new DomainError("Não foi possível alterar a IA.", 503);
    return { enabled };
  }
  const { data, error } = await admin
    .from("platform_ai_control")
    .select("enabled")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new DomainError("Não foi possível consultar a IA.", 503);
  return { enabled: data?.enabled === true };
}
