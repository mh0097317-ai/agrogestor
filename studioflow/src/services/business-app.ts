import { cache } from "react";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isDemo, readDemo } from "./server-demo";

export interface BusinessApp {
  slug: string;
  name: string;
  logo: string;
  color: string;
}

/** O mínimo para o app instalável da página (nome, logo e cor). Só dados já públicos. */
export const businessApp = cache(async (slug: string): Promise<BusinessApp | null> => {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null;
  try {
    if (isDemo()) {
      const store = await readDemo(slug);
      if (store.business.slug !== slug) return null;
      const { name, logo, color } = store.business;
      return { slug, name, logo: logo || "", color: safeColor(color) };
    }
    const { data } = await createSupabaseAdmin()
      .from("businesses")
      .select("slug,name,logo,color")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return null;
    return {
      slug,
      name: data.name as string,
      logo: (data.logo as string) || "",
      color: safeColor(data.color as string | null),
    };
  } catch {
    return null;
  }
});

export function safeColor(color?: string | null) {
  return /^#[0-9a-f]{6}$/i.test(color || "") ? color! : "#16130F";
}
