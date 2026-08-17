"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type ActionState } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

const initial: ActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-[-.02em] text-ink">Entrar</h1>
      <p className="mt-1.5 text-sm text-muted">Acesse sua conta do Agrogestor.</p>

      <form action={action} className="mt-7 flex flex-col gap-4">
        {state.erro && (
          <div className="rounded-[10px] border border-danger/20 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
            {state.erro}
          </div>
        )}
        <Field label="E-mail">
          <Input name="email" type="email" placeholder="voce@fazenda.com.br" autoComplete="email" required />
        </Field>
        <Field label="Senha">
          <Input name="senha" type="password" placeholder="••••••••" autoComplete="current-password" required />
        </Field>
        <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-primary-600 hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
