import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DomainError } from "@/lib/availability";

export async function createSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new DomainError(
      "Conecte um projeto Supabase para habilitar sua conta.",
      503,
    );
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Proxy refreshes cookies in Server Components. */
        }
      },
    },
  });
}
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new DomainError(
      "Configure as credenciais de servidor do Supabase.",
      503,
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function requireMembership() {
  const client = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new DomainError("Entre na sua conta para acessar o painel.", 401);
  const selectedBusiness = (await cookies()).get("studioflow-business")?.value;
  let query = client
    .from("business_members")
    .select("business_id,role")
    .eq("user_id", user.id)
    .eq("active", true);
  if (selectedBusiness) query = query.eq("business_id", selectedBusiness);
  const { data: membership, error: membershipError } = await query
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (membershipError)
    throw new DomainError("Não foi possível consultar sua empresa.", 503);
  if (!membership)
    throw new DomainError("Conclua o cadastro do seu estabelecimento.", 403);
  return {
    client,
    businessId: membership.business_id as string,
    role: membership.role as string,
    user,
  };
}
