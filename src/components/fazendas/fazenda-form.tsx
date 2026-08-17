"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { FormState } from "@/modules/fazendas/actions";

export interface FazendaDefaults {
  nome?: string;
  produtorNome?: string;
  documento?: string;
  municipio?: string;
  estado?: string;
  areaTotal?: string;
  areaProdutiva?: string;
  observacoes?: string;
}

export function FazendaForm({
  action,
  defaults = {},
  submitLabel = "Salvar fazenda",
  cancelHref = "/fazendas",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  defaults?: FazendaDefaults;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);

  return (
    <form action={formAction}>
      <Card>
        <CardContent className="flex flex-col gap-5 pt-5">
          {state.erro && (
            <div className="rounded-[10px] border border-danger/20 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
              {state.erro}
            </div>
          )}

          <Field label="Nome da fazenda">
            <Input name="nome" defaultValue={defaults.nome} placeholder="Ex.: Fazenda Santa Clara" required />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Proprietário (opcional)">
              <Input name="produtorNome" defaultValue={defaults.produtorNome} placeholder="Nome do produtor" />
            </Field>
            <Field label="Documento (CPF/CNPJ)">
              <Input name="documento" defaultValue={defaults.documento} placeholder="Opcional" />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
            <Field label="Município">
              <Input name="municipio" defaultValue={defaults.municipio} placeholder="Ex.: Goiatuba" />
            </Field>
            <Field label="UF">
              <Input name="estado" defaultValue={defaults.estado} placeholder="GO" maxLength={2} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Área total (ha)" hint="Use vírgula para decimais.">
              <Input name="areaTotal" defaultValue={defaults.areaTotal} placeholder="Ex.: 184,3" inputMode="decimal" />
            </Field>
            <Field label="Área produtiva (ha)">
              <Input name="areaProdutiva" defaultValue={defaults.areaProdutiva} placeholder="Ex.: 160,0" inputMode="decimal" />
            </Field>
          </div>

          <Field label="Observações">
            <textarea
              name="observacoes"
              defaultValue={defaults.observacoes}
              rows={3}
              placeholder="Anotações sobre a propriedade…"
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-subtle focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20"
            />
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : submitLabel}
            </Button>
            <Link href={cancelHref}>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
