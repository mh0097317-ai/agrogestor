"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type ActionState } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

const initial: ActionState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-[-.02em] text-ink">Criar conta</h1>
      <p className="mt-1.5 text-sm text-muted">Comece a gerir sua operação rural.</p>

      <form action={action} className="mt-7 flex flex-col gap-4">
        {state.erro && (
          <div className="rounded-[10px] border border-danger/20 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
            {state.erro}
          </div>
        )}
        <Field label="Nome da empresa / fazenda">
          <Input name="nomeEmpresa" placeholder="Ex.: Agropecuária Santa Clara" required />
        </Field>
        <Field label="Seu nome">
          <Input name="nome" placeholder="Nome completo" autoComplete="name" required />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" placeholder="voce@fazenda.com.br" autoComplete="email" required />
        </Field>
        <Field label="Senha" hint="Mínimo de 6 caracteres.">
          <Input name="senha" type="password" placeholder="••••••••" autoComplete="new-password" required />
        </Field>
        <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
          {pending ? "Criando…" : "Criar conta"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-primary-600 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
