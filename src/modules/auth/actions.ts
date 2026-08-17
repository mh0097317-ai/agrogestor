"use server";

import { redirect } from "next/navigation";
import { registrarTenant, autenticar, AuthError } from "./service";
import { createSession, destroySession } from "./session";
import { loginSchema, registerSchema } from "./schemas";

export interface ActionState {
  erro?: string;
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const session = await autenticar(parsed.data);
    await createSession(session);
  } catch (e) {
    if (e instanceof AuthError) return { erro: e.message };
    throw e;
  }
  redirect("/dashboard");
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    nomeEmpresa: formData.get("nomeEmpresa"),
    nome: formData.get("nome"),
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const session = await registrarTenant(parsed.data);
    await createSession(session);
  } catch (e) {
    if (e instanceof AuthError) return { erro: e.message };
    throw e;
  }
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
