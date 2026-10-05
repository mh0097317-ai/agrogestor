import { assertModule, type ModuleKey } from "@/lib/modules";
import { requireMembership } from "@/lib/supabase/server";
import { isDemo, readDemo } from "./server-demo";
import { demoWorkspaceSlug } from "./server-store";

/** Ações do painel de um módulo que o plano do estabelecimento não inclui são recusadas. */
export async function requireModule(key: ModuleKey) {
  if (isDemo()) {
    const store = await readDemo(await demoWorkspaceSlug());
    assertModule(store.access?.modules, key);
    return;
  }
  const { access } = await requireMembership();
  assertModule(access.modules, key);
}
