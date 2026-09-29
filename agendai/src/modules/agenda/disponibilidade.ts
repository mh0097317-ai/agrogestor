import "server-only";
import type { Negocio } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { diaSemanaDe, hojeYmd, instante, minParaHora, somarDiasYmd } from "@/lib/tempo";

export const STATUS_ATIVOS = ["PENDENTE", "CONFIRMADO"] as const;

export interface Horario {
  /** ISO do início (UTC) */
  inicio: string;
  /** "09:15" no fuso do negócio */
  hora: string;
  /** profissionais livres nesse horário */
  profissionais: string[];
}

type Intervalo = { inicio: number; fim: number }; // epoch ms

function sobrepoe(a: Intervalo, b: Intervalo) {
  return a.inicio < b.fim && b.inicio < a.fim;
}

/** Data de calendário está dentro da janela que o negócio aceita agendamentos? */
export function dataDentroDaJanela(negocio: Negocio, ymd: string): boolean {
  const hoje = hojeYmd(negocio.fusoHorario);
  return ymd >= hoje && ymd <= somarDiasYmd(hoje, negocio.janelaDias);
}

/**
 * Calcula os horários livres de um serviço num dia.
 * - usa a jornada de cada profissional (ou o horário do negócio, se ele não tiver jornada)
 * - remove horários ocupados por agendamentos ativos e bloqueios
 * - respeita antecedência mínima e janela de dias
 */
export async function horariosDisponiveis(opts: {
  negocio: Negocio;
  servicoId: string;
  data: string; // YYYY-MM-DD
  profissionalId?: string | null;
  ignorarAntecedencia?: boolean;
}): Promise<Horario[]> {
  const { negocio, servicoId, data } = opts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return [];
  if (!opts.ignorarAntecedencia && !dataDentroDaJanela(negocio, data)) return [];

  const servico = await prisma.servico.findFirst({
    where: { id: servicoId, negocioId: negocio.id, ativo: true },
  });
  if (!servico) return [];

  const profissionais = await prisma.profissional.findMany({
    where: {
      negocioId: negocio.id,
      ativo: true,
      servicos: { some: { id: servico.id } },
      ...(opts.profissionalId ? { id: opts.profissionalId } : {}),
    },
    include: { jornadas: true },
    orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
  });
  if (profissionais.length === 0) return [];

  const fuso = negocio.fusoHorario;
  const diaSemana = diaSemanaDe(data);
  const inicioDia = instante(data, 0, fuso);
  const fimDia = instante(somarDiasYmd(data, 1), 0, fuso);
  const ids = profissionais.map((p) => p.id);

  const [agendamentos, bloqueios, horariosNegocio] = await Promise.all([
    prisma.agendamento.findMany({
      where: {
        profissionalId: { in: ids },
        status: { in: [...STATUS_ATIVOS] },
        inicio: { lt: fimDia },
        fim: { gt: inicioDia },
      },
      select: { profissionalId: true, inicio: true, fim: true },
    }),
    prisma.bloqueio.findMany({
      where: {
        negocioId: negocio.id,
        OR: [{ profissionalId: null }, { profissionalId: { in: ids } }],
        inicio: { lt: fimDia },
        fim: { gt: inicioDia },
      },
      select: { profissionalId: true, inicio: true, fim: true },
    }),
    prisma.horarioFuncionamento.findMany({ where: { negocioId: negocio.id, diaSemana } }),
  ]);

  const agora = Date.now();
  const minimo = opts.ignorarAntecedencia ? agora : agora + negocio.antecedenciaMinutos * 60_000;
  const passo = Math.max(5, negocio.intervaloSlotMinutos);
  const duracaoMs = servico.duracaoMin * 60_000;

  const porHorario = new Map<number, { hora: string; pros: string[] }>();

  for (const p of profissionais) {
    const jornadas = p.jornadas.length > 0 ? p.jornadas.filter((j) => j.diaSemana === diaSemana) : horariosNegocio;

    const ocupado: Intervalo[] = [
      ...agendamentos.filter((a) => a.profissionalId === p.id),
      ...bloqueios.filter((b) => b.profissionalId === null || b.profissionalId === p.id),
    ].map((x) => ({ inicio: x.inicio.getTime(), fim: x.fim.getTime() }));

    for (const j of jornadas) {
      for (let min = j.inicioMin; min + servico.duracaoMin <= j.fimMin; min += passo) {
        const inicio = instante(data, min, fuso).getTime();
        if (inicio < minimo) continue;
        const slot = { inicio, fim: inicio + duracaoMs };
        if (ocupado.some((o) => sobrepoe(o, slot))) continue;
        const item = porHorario.get(inicio) ?? { hora: minParaHora(min), pros: [] };
        item.pros.push(p.id);
        porHorario.set(inicio, item);
      }
    }
  }

  return [...porHorario.entries()]
    .sort(([a], [b]) => a - b)
    .map(([inicio, { hora, pros }]) => ({ inicio: new Date(inicio).toISOString(), hora, profissionais: pros }));
}

/** Dias (próximos N) em que o negócio abre — usado para destacar o calendário público. */
export async function diasComExpediente(negocio: Negocio): Promise<number[]> {
  const [horarios, jornadas] = await Promise.all([
    prisma.horarioFuncionamento.findMany({ where: { negocioId: negocio.id }, select: { diaSemana: true } }),
    prisma.jornada.findMany({
      where: { profissional: { negocioId: negocio.id, ativo: true } },
      select: { diaSemana: true },
    }),
  ]);
  return [...new Set([...horarios, ...jornadas].map((h) => h.diaSemana))].sort();
}
