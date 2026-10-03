import { createSupabaseServer } from "@/lib/supabase/server";
import { isDemo } from "@/services/server-demo";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
import { cookies } from "next/headers";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (isDemo()) (await cookies()).delete("studioflow-demo-business");
    else await (await createSupabaseServer()).auth.signOut();
    (await cookies()).delete("studioflow-business");
    return respond({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
