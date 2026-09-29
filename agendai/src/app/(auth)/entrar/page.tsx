import type { Metadata } from "next";
import Link from "next/link";
import { FormEntrar } from "@/components/auth/form-entrar";

export const metadata: Metadata = { title: "Entrar" };

export default function PaginaEntrar() {
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Bem-vindo de volta 👋</h1>
      <p className="mt-2 text-suave">Entre para ver sua agenda.</p>
      <FormEntrar />
      <p className="mt-6 text-center text-sm text-suave">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-marca-600 hover:underline">
          Criar agenda grátis
        </Link>
      </p>
    </>
  );
}
