import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isDemo } from "./server-demo";

/*
 * Erros que precisam durar mais que os logs da Vercel (cerca de uma hora):
 * ficam 30 dias no banco e aparecem no /admin. Só código e contexto técnico,
 * nunca texto de mensagem, telefone ou chave.
 */

const keep = 30 * 86_400_000;

/** Records one error. Never throws. */
export async function recordError(
  scope: string,
  code: string,
  input: {
    businessId?: string | null;
    detail?: Record<string, string | number | boolean | null>;
  } = {},
) {
  if (isDemo()) return;
  try {
    await createSupabaseAdmin()
      .from("app_errors")
      .insert({
        business_id: input.businessId || null,
        scope: scope.slice(0, 60),
        code: code.slice(0, 120),
        detail: input.detail || {},
      });
  } catch {
    // Logging must never break the caller.
  }
}

/** An error's message without anything that looks like a key or token. */
export const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message.replace(/[A-Za-z0-9_\-.]{24,}/g, "…").slice(0, 200)
    : "unknown";

/** For cron jobs: records the failure and answers with `fallback`. */
export const failedJob =
  <T>(scope: string, fallback: T) =>
  (error: unknown) => {
    void recordError("cron", scope, { detail: { error: errorText(error) } });
    return fallback;
  };

/** Daily cleanup of what is older than 30 days. */
export async function pruneErrors() {
  if (isDemo()) return;
  await createSupabaseAdmin()
    .from("app_errors")
    .delete()
    .lt("created_at", new Date(Date.now() - keep).toISOString());
}
