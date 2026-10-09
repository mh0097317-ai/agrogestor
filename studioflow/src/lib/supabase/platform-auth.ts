import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@/lib/availability";

// Independent from the business login. Only the server reads this session.
export const platformCookieName = "studioflow-platform-auth";
export function createPlatformAuthClient(
  url: string,
  key: string,
  cookies: CookieMethodsServer,
) {
  return createServerClient(url, key, {
    cookieOptions: {
      name: platformCookieName,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies,
  });
}

export async function signInPlatform(
  client: SupabaseClient,
  credentials: { email: string; password: string },
  isAdmin: (userId: string) => Promise<boolean>,
) {
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error || !data.user)
    throw new DomainError(
      "Não foi possível entrar. Confira seus dados e seu acesso administrativo.",
      401,
    );
  try {
    if (!(await isAdmin(data.user.id)))
      throw new DomainError(
        "Não foi possível entrar. Confira seus dados e seu acesso administrativo.",
        401,
      );
  } catch (cause) {
    // Revoke only the session just created, never the business sessions.
    await client.auth.signOut({ scope: "local" });
    throw cause;
  }
}
