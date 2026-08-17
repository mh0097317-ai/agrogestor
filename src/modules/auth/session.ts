import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Perfil } from "@prisma/client";

const COOKIE = "agro_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

export interface SessionPayload {
  userId: string;
  tenantId: string;
  perfil: Perfil;
  nome: string;
  email: string;
  [key: string]: unknown;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não configurado no ambiente.");
  return new TextEncoder().encode(s);
}

/** Cria a sessão assinada (JWT) e grava no cookie httpOnly. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Lê e valida a sessão do cookie. Retorna null se ausente/inválida. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Remove a sessão (logout). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
