import { cookies } from "next/headers";
import { DomainError } from "@/lib/availability";
import { createPlatformAuthClient } from "@/lib/supabase/platform-auth";

export async function createPlatformServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new DomainError("O acesso administrativo não está configurado.", 503);
  const jar = await cookies();
  return createPlatformAuthClient(url, key, {
    getAll: () => jar.getAll(),
    setAll: (values) => {
      try {
        values.forEach(({ name, value, options }) =>
          jar.set(name, value, options),
        );
      } catch {
        // The proxy refreshes the admin session when rendering Server Components.
      }
    },
  });
}
