import type { Metadata } from "next";
import Link from "next/link";
import { FormCadastro } from "@/components/auth/form-cadastro";

export const metadata: Metadata = { title: "Criar conta" };

export default async function PaginaCadastro(props: PageProps<"/cadastro">) {
  const { tipo } = await props.searchParams;
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Crie sua agenda online</h1>
      <p className="mt-2 text-suave">Em 1 minuto seu link de agendamento está no ar. Grátis para começar.</p>
      <FormCadastro tipoInicial={typeof tipo === "string" ? tipo : undefined} />
      <p className="mt-6 text-center text-sm text-suave">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-marca-600 hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
