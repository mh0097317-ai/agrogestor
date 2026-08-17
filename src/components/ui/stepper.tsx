import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, Clock } from "lucide-react";
import type { StatusEtapa } from "@prisma/client";

export interface Etapa {
  nome: string;
  status: StatusEtapa;
}

export function StageStepper({ etapas }: { etapas: Etapa[] }) {
  return (
    <div className="overflow-x-auto">
    <div className="flex min-w-[560px] items-start">
      {etapas.map((e, i) => {
        const done = e.status === "CONCLUIDA";
        const active = e.status === "EM_ANDAMENTO";
        return (
          <div key={i} className="relative flex flex-1 flex-col items-center gap-2 text-center">
            {i > 0 && (
              <span
                className={cn(
                  "absolute left-[-50%] top-[22px] h-0.5 w-full",
                  done || active ? "bg-primary-500" : "bg-border",
                )}
              />
            )}
            <div
              className={cn(
                "z-10 grid h-11 w-11 place-items-center rounded-full border-2 bg-surface",
                done && "border-primary-500 bg-primary-500 text-white shadow-[0_6px_14px_rgba(22,163,74,.3)]",
                active && "border-warning bg-warning-bg text-warning",
                !done && !active && "border-border text-subtle",
              )}
            >
              {done ? <Check size={20} strokeWidth={2.6} /> : <Clock size={18} />}
            </div>
            <div className="text-[13px] font-semibold text-ink">{e.nome}</div>
            <div className={cn("text-[11.5px]", active ? "font-semibold text-warning" : "text-muted")}>
              {done ? "Concluído" : active ? "Em andamento" : "Pendente"}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
