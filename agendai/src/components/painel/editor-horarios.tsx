"use client";

import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIAS_SEMANA } from "@/lib/tempo";

export type Faixa = { diaSemana: number; inicio: string; fim: string };

const ORDEM = [1, 2, 3, 4, 5, 6, 0];

/** Editor de horários semanais com múltiplas faixas por dia (ex.: pausa do almoço). */
export function EditorHorarios({ valor, onChange }: { valor: Faixa[]; onChange: (v: Faixa[]) => void }) {
  function alternarDia(dia: number) {
    const tem = valor.some((f) => f.diaSemana === dia);
    onChange(tem ? valor.filter((f) => f.diaSemana !== dia) : [...valor, { diaSemana: dia, inicio: "09:00", fim: "19:00" }]);
  }
  function atualizar(indice: number, campo: "inicio" | "fim", v: string) {
    onChange(valor.map((f, i) => (i === indice ? { ...f, [campo]: v } : f)));
  }
  function adicionarFaixa(dia: number) {
    const doDia = valor.filter((f) => f.diaSemana === dia);
    const ultimo = doDia[doDia.length - 1]?.fim ?? "13:00";
    const [h] = ultimo.split(":").map(Number);
    onChange([...valor, { diaSemana: dia, inicio: `${String(Math.min(h + 1, 22)).padStart(2, "0")}:00`, fim: `${String(Math.min(h + 5, 23)).padStart(2, "0")}:00` }]);
  }
  function remover(indice: number) {
    onChange(valor.filter((_, i) => i !== indice));
  }

  return (
    <div className="divide-y divide-linha rounded-2xl border border-linha">
      {ORDEM.map((dia) => {
        const faixas = valor.map((f, i) => ({ ...f, i })).filter((f) => f.diaSemana === dia);
        const aberto = faixas.length > 0;
        return (
          <div key={dia} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3 py-2.5">
            <button
              type="button"
              onClick={() => alternarDia(dia)}
              className="flex w-28 shrink-0 items-center gap-2.5 py-1.5 text-left text-sm font-semibold text-ink"
            >
              <span className={cn("relative h-5 w-9 rounded-full transition", aberto ? "bg-marca-500" : "bg-linha-forte")}>
                <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", aberto ? "left-[18px]" : "left-0.5")} />
              </span>
              {DIAS_SEMANA[dia].slice(0, 3)}
            </button>
            {aberto ? (
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {faixas.map((f) => (
                  <div key={f.i} className="flex items-center gap-1.5">
                    <input type="time" value={f.inicio} onChange={(e) => atualizar(f.i, "inicio", e.target.value)} className="h-9 w-full min-w-0 max-w-[7.5rem] flex-1 rounded-lg border border-linha-forte bg-papel px-2 text-sm tabular-nums" />
                    <span className="text-suave">–</span>
                    <input type="time" value={f.fim} onChange={(e) => atualizar(f.i, "fim", e.target.value)} className="h-9 w-full min-w-0 max-w-[7.5rem] flex-1 rounded-lg border border-linha-forte bg-papel px-2 text-sm tabular-nums" />
                    {faixas.length > 1 && (
                      <button type="button" onClick={() => remover(f.i)} className="grid size-8 place-items-center rounded-lg text-suave hover:bg-erro-bg hover:text-erro" aria-label="Remover faixa">
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
                {faixas.length < 3 && (
                  <button type="button" onClick={() => adicionarFaixa(dia)} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-marca-600 hover:underline">
                    <Plus className="size-3.5" /> intervalo (ex.: após o almoço)
                  </button>
                )}
              </div>
            ) : (
              <span className="py-1.5 text-sm text-apagado">Fechado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
