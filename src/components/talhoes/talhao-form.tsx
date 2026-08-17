"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { FormState } from "@/modules/talhoes/actions";

interface Opcao {
  id: string;
  label: string;
}

const STATUS: { value: string; label: string }[] = [
  { value: "DISPONIVEL", label: "Disponível" },
  { value: "EM_PLANTIO", label: "Em plantio" },
  { value: "EM_MANEJO", label: "Em manejo" },
  { value: "EM_PRODUCAO", label: "Em produção" },
  { value: "EM_COLHEITA", label: "Em colheita" },
  { value: "ATENCAO", label: "Atenção" },
  { value: "INATIVO", label: "Inativo" },
];

export interface TalhaoDefaults {
  fazendaId?: string;
  codigo?: string;
  nome?: string;
  area?: string;
  culturaAtualId?: string;
  status?: string;
}

export function TalhaoForm({
  action,
  fazendas,
  culturas,
  defaults = {},
  submitLabel = "Salvar talhão",
  cancelHref = "/talhoes",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  fazendas: Opcao[];
  culturas: Opcao[];
  defaults?: TalhaoDefaults;
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

          <Field label="Fazenda">
            <Select name="fazendaId" defaultValue={defaults.fazendaId ?? ""} required>
              <option value="" disabled>Selecione a fazenda</option>
              {fazendas.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
            <Field label="Código">
              <Input name="codigo" defaultValue={defaults.codigo} placeholder="T-03" required />
            </Field>
            <Field label="Nome (opcional)">
              <Input name="nome" defaultValue={defaults.nome} placeholder="Ex.: Talhão da sede" />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Área (ha)">
              <Input name="area" defaultValue={defaults.area} placeholder="Ex.: 42,7" inputMode="decimal" required />
            </Field>
            <Field label="Cultura atual">
              <Select name="culturaAtualId" defaultValue={defaults.culturaAtualId ?? ""}>
                <option value="">— Nenhuma —</option>
                {culturas.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={defaults.status ?? "DISPONIVEL"}>
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : submitLabel}
            </Button>
            <Link href={cancelHref}>
              <Button type="button" variant="secondary">Cancelar</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
