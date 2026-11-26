import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/lib/availability";
import { AccessError } from "@/lib/access";
export function respond(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return respond(
      { error: error.issues[0]?.message || "Confira os dados enviados." },
      400,
    );
  if (error instanceof AccessError)
    return respond(
      { error: error.message, access: error.access },
      error.status,
    );
  if (error instanceof DomainError)
    return respond({ error: error.message }, error.status);
  console.error(
    "StudioFlow API error:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return respond(
    { error: "Não foi possível concluir esta ação. Tente novamente." },
    500,
  );
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  try {
    if (new URL(origin).origin !== requestOrigin(request))
      throw new DomainError("Origem não autorizada.", 403);
  } catch {
    throw new DomainError("Origem não autorizada.", 403);
  }
}
export function requestOrigin(request: Request) {
  const internal = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    request.headers.get("host") ||
    internal.host;
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const protocol =
    forwardedProtocol === "https" || forwardedProtocol === "http"
      ? `${forwardedProtocol}:`
      : internal.protocol;
  return new URL(`${protocol}//${host}`).origin;
}
const rateBuckets = new Map<string, { count: number; expires: number }>();
/** Até `max` por minuto para a chave; não lança, só diz se pode. */
export function allowRate(key: string, max: number) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.expires < now) {
    rateBuckets.set(key, { count: 1, expires: now + 60000 });
    return true;
  }
  return ++bucket.count <= max;
}
export function limitPublicMutation(
  request: Request,
  options: { scope: string; max: number } = { scope: "public", max: 20 },
) {
  const now = Date.now();
  if (rateBuckets.size > 5000)
    for (const [key, bucket] of rateBuckets)
      if (bucket.expires < now) rateBuckets.delete(key);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const key = `${options.scope}:${ip}`;
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.expires < now)
    rateBuckets.set(key, { count: 1, expires: now + 60000 });
  else if (++bucket.count > options.max)
    throw new DomainError(
      "Muitas tentativas. Aguarde um minuto e tente novamente.",
      429,
    );
}

/**
 * Limite que vale entre instâncias (banco). Fica atrás do limite em memória
 * e só nas rotas caras. Se o banco não responder, deixa passar: o limite em
 * memória e o teto diário da IA continuam valendo.
 */
export async function limitPersistent(
  request: Request,
  options: { scope: string; max: number; windowSeconds?: number },
) {
  if (process.env.STUDIOFLOW_DEMO_MODE || !process.env.NEXT_PUBLIC_SUPABASE_URL)
    return;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const { createHash } = await import("node:crypto");
  const key = `${options.scope}:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
  try {
    const { createSupabaseAdmin } = await import("@/lib/supabase/server");
    const { data, error } = await createSupabaseAdmin().rpc("rate_limit_hit", {
      p_key: key,
      p_max: options.max,
      p_window_seconds: options.windowSeconds ?? 600,
    });
    if (!error && data === false)
      throw new DomainError(
        "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        429,
      );
  } catch (cause) {
    if (cause instanceof DomainError) throw cause;
  }
}
