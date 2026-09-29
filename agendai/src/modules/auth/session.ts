import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Papel } from "@prisma/client";

export const COOKIE_SESSAO = "agendai_sessao";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export interface Sessao {
  usuarioId: string;
  negocioId: string;
  nome: string;
  email: string;
  papel: Papel;
  [k: string]: unknown;
}

function segredo(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não configurado.");
  return new TextEncoder().encode(s);
}

export async function criarSessao(dados: Sessao): Promise<void> {
  const token = await new SignJWT(dados)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(segredo());
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function lerSessao(): Promise<Sessao | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo());
    return payload as unknown as Sessao;
  } catch {
    return null;
  }
}

export async function encerrarSessao(): Promise<void> {
  (await cookies()).delete(COOKIE_SESSAO);
}
