import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "@/services/server-http";
import { createPlatformAuthClient } from "@/lib/supabase/platform-auth";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const platform =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin/");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (
      process.env.NODE_ENV === "production" &&
      (pathname.startsWith("/dashboard") ||
        pathname === "/tv" ||
        (platform &&
          !pathname.startsWith("/api/") &&
          pathname !== "/admin/login"))
    )
      return NextResponse.redirect(
        new URL(platform ? "/admin/login" : "/login", requestOrigin(request)),
      );
    return response;
  }
  const cookieMethods = {
    getAll: () => request.cookies.getAll(),
    setAll: (
      values: {
        name: string;
        value: string;
        options: import("@supabase/ssr").CookieOptions;
      }[],
    ) => {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      values.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options),
      );
    },
  };
  const client = platform
    ? createPlatformAuthClient(url, key, cookieMethods)
    : createServerClient(url, key, { cookies: cookieMethods });
  const {
    data: { user },
  } = await client.auth.getUser();
  if (
    !user &&
    (pathname.startsWith("/dashboard") ||
      pathname === "/tv" ||
      pathname === "/admin" ||
      (pathname.startsWith("/admin/") && pathname !== "/admin/login"))
  ) {
    const redirect = NextResponse.redirect(
      new URL(platform ? "/admin/login" : "/login", requestOrigin(request)),
    );
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/tv",
    "/api/admin/:path*",
    "/onboarding/:path*",
    "/login",
    "/auth/:path*",
    "/api/workspace",
    "/api/workspace/:path*",
    "/api/onboarding",
    "/api/uploads",
    "/equipe/convite/:path*",
    "/api/professional-invites",
  ],
};
