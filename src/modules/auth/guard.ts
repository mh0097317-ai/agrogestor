import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";
import { can, type Permissao } from "./rbac";

/** Garante que há sessão válida; senão redireciona para /login. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Garante sessão + permissão; senão 403. */
export async function requirePermissao(permissao: Permissao): Promise<SessionPayload> {
  const session = await requireSession();
  if (!can(session.perfil, permissao)) {
    redirect("/dashboard?erro=sem-permissao");
  }
  return session;
}
