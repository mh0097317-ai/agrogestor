"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { cadastrar } from "@/modules/auth/actions";
import { TIPOS_NEGOCIO } from "@/lib/tipos-negocio";
import { cn } from "@/lib/utils";
import { Botao, Campo, Rotulo } from "@/components/ui";
import { mascaraTelefone } from "@/components/mascara";

const TIPOS = ["BARBEARIA", "SALAO_FEMININO", "SALAO_MASCULINO", "SALAO_UNISSEX", "ESTETICA", "MANICURE"] as const;

export function FormCadastro({ tipoInicial }: { tipoInicial?: string }) {
  const [estado, acao, pendente] = useActionState(cadastrar, undefined);
  const [tipo, setTipo] = useState<string>(estado?.campos?.tipo ?? (TIPOS.includes(tipoInicial as never) ? tipoInicial! : "BARBEARIA"));
  const [whats, setWhats] = useState(estado?.campos?.whatsapp ?? "");

  return (
    <form action={acao} className="mt-8 grid gap-5">
      {estado?.erro && <p className="rounded-xl bg-erro-bg px-4 py-3 text-sm font-medium text-erro">{estado.erro}</p>}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Qual é o seu negócio?</legend>
        <input type="hidden" name="tipo" value={tipo} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TIPOS.map((t) => {
            const info = TIPOS_NEGOCIO[t];
            const ativo = tipo === t;
            return (
              <button
                type="button"
                key={t}
                onClick={() => setTipo(t)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-left text-sm font-semibold transition",
                  ativo ? "border-ink bg-ink text-white" : "border-linha-forte bg-papel text-ink hover:border-ink/40",
                )}
              >
                <span className="text-xl">{info.emoji}</span>
                {info.rotulo}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <Rotulo htmlFor="nomeNegocio">Nome do estabelecimento</Rotulo>
        <Campo id="nomeNegocio" name="nomeNegocio" required placeholder="Ex.: Barbearia do Zé" defaultValue={estado?.campos?.nomeNegocio} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Rotulo htmlFor="nome">Seu nome</Rotulo>
          <Campo id="nome" name="nome" autoComplete="name" required defaultValue={estado?.campos?.nome} />
        </div>
        <div>
          <Rotulo htmlFor="whatsapp" dica="Recebe os avisos">
            WhatsApp
          </Rotulo>
          <Campo
            id="whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            required
            placeholder="(11) 99999-9999"
            value={whats}
            onChange={(e) => setWhats(mascaraTelefone(e.target.value))}
          />
        </div>
      </div>
      <div>
        <Rotulo htmlFor="email">E-mail</Rotulo>
        <Campo id="email" name="email" type="email" autoComplete="email" required defaultValue={estado?.campos?.email} />
      </div>
      <div>
        <Rotulo htmlFor="senha" dica="mín. 6 caracteres">
          Senha
        </Rotulo>
        <Campo id="senha" name="senha" type="password" autoComplete="new-password" minLength={6} required />
      </div>
      <Botao tamanho="lg" disabled={pendente} className="mt-1">
        {pendente && <Loader2 className="size-5 animate-spin" />} Criar minha agenda
      </Botao>
      <p className="text-center text-xs text-suave">Já criamos serviços e horários sugeridos — você ajusta depois.</p>
    </form>
  );
}
