import { createSupabaseAdmin } from "@/lib/supabase/server";
import { refreshMarketingToken, runMarketing } from "@/services/marketing/service";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** pg_cron a cada 15 minutos, com o mesmo segredo dos lembretes. */
export async function POST(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response("forbidden", { status: 401 });
  const { data, error } = await createSupabaseAdmin().rpc("verify_appointment_scheduler", {
    p_secret: token,
  });
  if (error || data !== true) return new Response("forbidden", { status: 401 });
  const [report, refreshed] = await Promise.all([runMarketing(), refreshMarketingToken()]);
  return Response.json({ ...report, refreshed });
}
