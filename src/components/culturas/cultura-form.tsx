"use client";

import { useActionState, useEffect, useRef } from "react";
import { criarCulturaAction, type FormState } from "@/modules/culturas/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";

export function CulturaForm() {
  const [state, action, pending] = useActionState(criarCulturaAction, {} as FormState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-4">
      {state.erro && (
        <div className="rounded-[10px] border border-danger/20 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
          {state.erro}
        </div>
      )}
      <Field label="Nome da cultura">
        <Input name="nome" placeholder="Ex.: Soja" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unidade">
          <Select name="unidadeProducao" defaultValue="sc">
            <option value="sc">Sacas (sc)</option>
            <option value="t">Toneladas (t)</option>
            <option value="kg">Quilos (kg)</option>
            <option value="@">Arroba (@)</option>
            <option value="cx">Caixas (cx)</option>
          </Select>
        </Field>
        <Field label="Ciclo (dias)">
          <Input name="cicloDias" inputMode="numeric" placeholder="Ex.: 120" />
        </Field>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Salvando…" : "Adicionar cultura"}
      </Button>
    </form>
  );
}
