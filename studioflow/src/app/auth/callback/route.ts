import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requestOrigin } from "@/services/server-http";
import { inviteRedirect } from "@/lib/invite-redirect";
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get("code"),
    origin = requestOrigin(request);
  if (code) {
    const client = await createSupabaseServer(),
      { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await client.auth.getUser();
      const { data } = await client
        .from("business_members")
        .select("business_id")
        .eq("user_id", user!.id)
        .eq("active", true)
        .limit(1);
      return NextResponse.redirect(
        new URL(
          inviteRedirect(url.searchParams.get("next")) ||
            (data?.length ? "/dashboard" : "/onboarding"),
          origin,
        ),
      );
    }
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", origin));
}
