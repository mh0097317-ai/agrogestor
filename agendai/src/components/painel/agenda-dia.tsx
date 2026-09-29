"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Lock, Trash2 } from "lucide-react";
import type { AgendamentoVM } from "@/modules/painel/vm";
import { excluirBloqueio } from "@/modules/painel/actions";
import { cn } from "@/lib/utils";
import { Avatar, Cartao } from "@/components/ui";
import { DetalheAgendamento } from "./detalhe-agendamento";

const PX_POR_HORA = 72;
const px = (min: number) => (min / 60) * PX_POR_HORA;

type Coluna = { id: string; nome: string; cor: string; jornada: { inicio: number; fim: number }[] };
type BloqueioVM = { id: string; profissionalId: string | null; inicioMin: number; fimMin: number; rotulo: string };

export function AgendaDia({
  nomeNegocio,
  colunas,
  agendamentos,
  bloqueios,
  inicioMin,
  fimMin,
  minutosAgora,
  minutosPorAg,
}: {
  nomeNegocio: string;
  colunas: Coluna[];
  agendamentos: AgendamentoVM[];
  bloqueios: BloqueioVM[];
  inicioMin: number;
  fimMin: number;
  minutosAgora: number | null;
  minutosPorAg: Record<string, [number, number]>;
}) {
  const [selecionado, setSelecionado] = useState<AgendamentoVM | null>(null);
  const [removendo, iniciar] = useTransition();
  const rolagem = useRef<HTMLDivElement>(null);
  const altura = px(fimMin - inicioMin);
  const horas = Array.from({ length: (fimMin - inicioMin) / 60 + 1 }, (_, i) => inicioMin + i * 60);

  // Rola até "agora" (ou primeiro agendamento) ao abrir.
  useEffect(() => {
    const alvo = minutosAgora ?? Math.min(...Object.values(minutosPorAg).map(([i]) => i), fimMin);
    if (rolagem.current && Number.isFinite(alvo)) {
      rolagem.current.scrollTop = Math.max(0, px(alvo - inicioMin) - 80);
    }
  }, [minutosAgora, minutosPorAg, inicioMin, fimMin]);

  if (colunas.length === 0) {
    return <Cartao className="p-10 text-center text-suave">Cadastre um profissional em Equipe para usar a agenda.</Cartao>;
  }

  return (
    <Cartao className="overflow-hidden">
      <div ref={rolagem} className="max-h-[calc(100dvh-280px)] min-h-96 overflow-auto">
        <div className="relative" style={{ minWidth: 56 + colunas.length * 170 }}>
          {/* Cabeçalho das colunas */}
          <div className="sticky top-0 z-20 flex border-b border-linha bg-papel/95 backdrop-blur">
            <div className="w-14 shrink-0" />
            {colunas.map((c) => {
              const n = agendamentos.filter((a) => a.profissional.id === c.id && a.status !== "CANCELADO").length;
              return (
                <div key={c.id} className="flex min-w-0 flex-1 items-center gap-2.5 border-l border-linha px-3 py-3">
                  <Avatar nome={c.nome} cor={c.cor} tamanho={32} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{c.nome}</p>
                    <p className="text-xs text-suave">{c.jornada.length === 0 ? "Folga" : `${n} ${n === 1 ? "horário" : "horários"}`}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative flex" style={{ height: altura }}>
            {/* Régua de horas */}
            <div className="relative w-14 shrink-0">
              {horas.map((h) => (
                <span
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[11px] font-medium tabular-nums text-apagado"
                  style={{ top: px(h - inicioMin) }}
                >
                  {h < 24 * 60 && `${String(h / 60).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>

            {/* Linhas */}
            <div className="pointer-events-none absolute inset-y-0 left-14 right-0">
              {horas.map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-linha" style={{ top: px(h - inicioMin) }} />
              ))}
              {horas.slice(0, -1).map((h) => (
                <div key={`m${h}`} className="absolute inset-x-0 border-t border-dashed border-linha/60" style={{ top: px(h + 30 - inicioMin) }} />
              ))}
            </div>

            {colunas.map((c) => {
              const fora = foraDaJornada(c.jornada, inicioMin, fimMin);
              return (
                <div key={c.id} className="relative min-w-0 flex-1 border-l border-linha">
                  {fora.map((f, i) => (
                    <div
                      key={i}
                      className="absolute inset-x-0 bg-[repeating-linear-gradient(-45deg,transparent_0_6px,rgb(23_21_28/0.035)_6px_12px)]"
                      style={{ top: px(f.inicio - inicioMin), height: px(f.fim - f.inicio) }}
                    />
                  ))}

                  {bloqueios
                    .filter((b) => b.profissionalId === null || b.profissionalId === c.id)
                    .map((b) => {
                      const top = Math.max(b.inicioMin, inicioMin);
                      const bottom = Math.min(b.fimMin, fimMin);
                      if (bottom <= top) return null;
                      return (
                        <div
                          key={b.id}
                          className="group absolute inset-x-1 z-[5] flex items-start gap-1.5 overflow-hidden rounded-lg border border-linha-forte bg-fundo/90 p-2 text-xs font-semibold text-suave"
                          style={{ top: px(top - inicioMin) + 1, height: px(bottom - top) - 2 }}
                        >
                          <Lock className="mt-0.5 size-3 shrink-0" />
                          <span className="flex-1 truncate">{b.rotulo}</span>
                          <button
                            onClick={() => iniciar(async () => void (await excluirBloqueio(b.id)))}
                            disabled={removendo}
                            className="rounded p-0.5 opacity-0 transition hover:bg-erro-bg hover:text-erro group-hover:opacity-100"
                            aria-label="Remover bloqueio"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      );
                    })}

                  {agendamentos
                    .filter((a) => a.profissional.id === c.id && a.status !== "CANCELADO")
                    .map((a) => {
                      const [ini, fim] = minutosPorAg[a.id];
                      const h = px(fim - ini) - 3;
                      const curto = h < 44;
                      const apagado = a.status === "NAO_COMPARECEU";
                      return (
                        <button
                          key={a.id}
                          onClick={() => setSelecionado(a)}
                          className={cn(
                            "absolute inset-x-1 z-10 overflow-hidden rounded-lg border-l-[3px] px-2 text-left transition hover:z-20 hover:shadow-cartao",
                            curto ? "flex items-center gap-1.5 py-0.5" : "py-1.5",
                            apagado && "opacity-50",
                            a.status === "PENDENTE" && "outline-2 outline-dashed outline-alerta/60",
                          )}
                          style={{
                            top: px(ini - inicioMin) + 1.5,
                            height: h,
                            borderColor: c.cor,
                            background: a.status === "CONCLUIDO" ? "var(--color-ok-bg)" : `color-mix(in srgb, ${c.cor} 13%, white)`,
                          }}
                        >
                          <p className={cn("truncate text-xs font-bold text-ink", apagado && "line-through")}>
                            {curto && <span className="mr-1 font-semibold tabular-nums text-suave">{a.hora}</span>}
                            {a.cliente.nome}
                          </p>
                          {!curto && (
                            <p className="truncate text-[11px] text-texto/80">
                              {a.hora}–{a.horaFim} · {a.servico.nome}
                            </p>
                          )}
                        </button>
                      );
                    })}
                </div>
              );
            })}

            {minutosAgora !== null && minutosAgora >= inicioMin && minutosAgora <= fimMin && (
              <div className="pointer-events-none absolute left-12 right-0 z-30 flex items-center" style={{ top: px(minutosAgora - inicioMin) }}>
                <span className="size-2.5 -translate-x-1/2 rounded-full bg-marca-500 ring-4 ring-marca-500/20" />
                <span className="h-0.5 flex-1 bg-marca-500" />
              </div>
            )}
          </div>
        </div>
      </div>
      <DetalheAgendamento ag={selecionado} nomeNegocio={nomeNegocio} aoFechar={() => setSelecionado(null)} />
    </Cartao>
  );
}

function foraDaJornada(jornada: { inicio: number; fim: number }[], de: number, ate: number) {
  const ordenada = [...jornada].sort((a, b) => a.inicio - b.inicio);
  const fora: { inicio: number; fim: number }[] = [];
  let cursor = de;
  for (const j of ordenada) {
    if (j.inicio > cursor) fora.push({ inicio: cursor, fim: Math.min(j.inicio, ate) });
    cursor = Math.max(cursor, j.fim);
  }
  if (cursor < ate) fora.push({ inicio: cursor, fim: ate });
  return fora.filter((f) => f.fim > f.inicio);
}
