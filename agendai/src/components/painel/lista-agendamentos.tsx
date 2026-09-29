"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { AgendamentoVM } from "@/modules/painel/vm";
import { cn, formatarPreco } from "@/lib/utils";
import { SeloStatus } from "@/components/ui";
import { DetalheAgendamento } from "./detalhe-agendamento";

export function ListaAgendamentos({
  itens,
  nomeNegocio,
  mostrarData,
}: {
  itens: AgendamentoVM[];
  nomeNegocio: string;
  mostrarData?: boolean;
}) {
  const [selecionado, setSelecionado] = useState<AgendamentoVM | null>(null);
  const agora = Date.now();

  return (
    <>
      <ul className="divide-y divide-linha">
        {itens.map((a) => {
          const emAndamento = new Date(a.inicio).getTime() <= agora && new Date(a.fim).getTime() > agora && a.status !== "CANCELADO";
          return (
            <li key={a.id}>
              <button
                onClick={() => setSelecionado(a)}
                className={cn(
                  "flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-papel-2 sm:px-5",
                  (a.status === "CANCELADO" || a.status === "NAO_COMPARECEU") && "opacity-55",
                )}
              >
                <div className="w-14 shrink-0 text-center">
                  <p className="font-display text-lg font-bold tabular-nums text-ink">{a.hora}</p>
                  {mostrarData ? (
                    <p className="truncate text-[11px] text-suave">{a.dataCurta}</p>
                  ) : emAndamento ? (
                    <p className="text-[11px] font-bold text-marca-500">agora</p>
                  ) : (
                    <p className="text-[11px] text-suave">{a.horaFim}</p>
                  )}
                </div>
                <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: a.profissional.cor }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{a.cliente.nome}</p>
                  <p className="truncate text-sm text-suave">
                    {a.servico.nome} · {a.profissional.nome}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-ink">{formatarPreco(a.precoCentavos)}</p>
                </div>
                <div className="hidden sm:block">
                  <SeloStatus status={a.status} />
                </div>
                <span className={cn("size-2 rounded-full sm:hidden", a.status === "PENDENTE" ? "bg-alerta" : "bg-transparent")} />
                <ChevronRight className="size-4 shrink-0 text-apagado" />
              </button>
            </li>
          );
        })}
      </ul>
      <DetalheAgendamento ag={selecionado} nomeNegocio={nomeNegocio} aoFechar={() => setSelecionado(null)} />
    </>
  );
}
