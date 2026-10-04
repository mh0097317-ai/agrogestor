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
    return respond({ error: error.message, access: error.access }, error.status);
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
export function limitPublicMutation(request: Request) {
  const now = Date.now();
  if (rateBuckets.size > 5000)
    for (const [key, bucket] of rateBuckets)
      if (bucket.expires < now) rateBuckets.delete(key);
  const key = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.expires < now)
    rateBuckets.set(key, { count: 1, expires: now + 60000 });
  else if (++bucket.count > 20)
    throw new DomainError(
      "Muitas tentativas. Aguarde um minuto e tente novamente.",
      429,
    );
}
