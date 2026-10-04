import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "@/services/server-http";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (
      process.env.NODE_ENV === "production" &&
      (request.nextUrl.pathname.startsWith("/dashboard") ||
        request.nextUrl.pathname === "/tv" ||
        request.nextUrl.pathname.startsWith("/admin"))
    )
      return NextResponse.redirect(new URL("/login", requestOrigin(request)));
    return response;
  }
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  const { pathname } = request.nextUrl;
  if (
    !user &&
    (pathname.startsWith("/dashboard") ||
      pathname === "/tv" ||
      pathname === "/admin" ||
      pathname.startsWith("/admin/"))
  ) {
    const redirect = NextResponse.redirect(
      new URL("/login", requestOrigin(request)),
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
  ],
};
