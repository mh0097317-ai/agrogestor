"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { entrar } from "@/modules/auth/actions";
import { Botao, Campo, Rotulo } from "@/components/ui";

export function FormEntrar() {
  const [estado, acao, pendente] = useActionState(entrar, undefined);
  return (
    <form action={acao} className="mt-8 grid gap-4">
      {estado?.erro && <p className="rounded-xl bg-erro-bg px-4 py-3 text-sm font-medium text-erro">{estado.erro}</p>}
      <div>
        <Rotulo htmlFor="email">E-mail</Rotulo>
        <Campo id="email" name="email" type="email" autoComplete="email" required defaultValue={estado?.campos?.email} />
      </div>
      <div>
        <Rotulo htmlFor="senha">Senha</Rotulo>
        <Campo id="senha" name="senha" type="password" autoComplete="current-password" required />
      </div>
      <Botao tamanho="lg" disabled={pendente} className="mt-2">
        {pendente && <Loader2 className="size-5 animate-spin" />} Entrar
      </Botao>
    </form>
  );
}
