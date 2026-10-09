import { after } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { recoverPendingConversations } from "@/services/assistant/recovery";
import { requestOrigin } from "@/services/server-http";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(
    /^Bearer /,
    "",
  );
  if (!/^[a-f0-9]{64}$/.test(token))
    return new Response("forbidden", { status: 401 });
  const { data, error } = await createSupabaseAdmin().rpc(
    "verify_appointment_scheduler",
    { p_secret: token },
  );
  if (error || data !== true) return new Response("forbidden", { status: 401 });
  const origin = requestOrigin(request);
  after(async () => {
    await recoverPendingConversations(origin);
  });
  return Response.json({ accepted: true });
}
