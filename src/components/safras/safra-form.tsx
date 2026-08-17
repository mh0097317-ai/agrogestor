"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { criarSafraAction, type FormState } from "@/modules/safras/actions";

interface Opcao { id: string; label: string }
interface TalhaoOpcao { id: string; codigo: string; fazenda: string; area: string }

const STATUS = [
  { value: "PLANEJADA", label: "Planejada" },
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "COLHIDA", label: "Colhida" },
  { value: "ENCERRADA", label: "Encerrada" },
];

export function SafraForm({
  fazendas,
  culturas,
  talhoes,
}: {
  fazendas: Opcao[];
  culturas: Opcao[];
  talhoes: TalhaoOpcao[];
}) {
  const [state, action, pending] = useActionState(criarSafraAction, {} as FormState);

  return (
    <form action={action}>
      <Card>
        <CardContent className="flex flex-col gap-5 pt-5">
          {state.erro && (
            <div className="rounded-[10px] border border-danger/20 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
              {state.erro}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nome da safra">
              <Input name="nome" placeholder="Ex.: 2026/2027" required />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue="PLANEJADA">
                {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Fazenda (opcional)">
              <Select name="fazendaId" defaultValue="">
                <option value="">— Todas / não definir —</option>
                {fazendas.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </Select>
            </Field>
            <Field label="Cultura">
              <Select name="culturaId" defaultValue="">
                <option value="">— Selecionar —</option>
                {culturas.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Produtividade estimada (por ha)" hint="Ex.: 60 (sc/ha)">
              <Input name="produtividadeEstimada" inputMode="decimal" placeholder="Ex.: 60" />
            </Field>
            <Field label="Preço de venda previsto (R$/unid.)" hint="Ex.: 120,00">
              <Input name="precoVendaPrevisto" inputMode="decimal" placeholder="Ex.: 120,00" />
            </Field>
          </div>

          <div>
            <div className="mb-1.5 text-[13px] font-medium text-text">Talhões da safra</div>
            {talhoes.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-border-strong bg-surface-2 px-3.5 py-3 text-[13px] text-muted">
                Nenhum talhão disponível. Cadastre talhões para vinculá-los à safra.
              </p>
            ) : (
              <div className="grid max-h-64 gap-2 overflow-y-auto rounded-[12px] border border-border p-2 sm:grid-cols-2">
                {talhoes.map((t) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[9px] px-3 py-2.5 hover:bg-surface-2"
                  >
                    <input type="checkbox" name="talhaoIds" value={t.id} className="h-4 w-4 accent-primary-500" />
                    <span className="flex-1">
                      <span className="font-semibold text-ink">{t.codigo}</span>
                      <span className="ml-1.5 text-[12px] text-muted">{t.fazenda}</span>
                    </span>
                    <span className="tnum text-[12px] text-subtle">{t.area} ha</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Criar safra"}</Button>
            <Link href="/safras"><Button type="button" variant="secondary">Cancelar</Button></Link>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
