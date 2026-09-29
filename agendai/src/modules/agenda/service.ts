import "server-only";
import { after } from "next/server";
import type { Negocio, StatusAgendamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTelefone } from "@/lib/utils";
import { instante, somarDiasYmd, ymdDe } from "@/lib/tempo";
import { notificar } from "@/modules/notificacoes/service";
import { horariosDisponiveis, STATUS_ATIVOS } from "./disponibilidade";

export class ErroAgenda extends Error {}

/** A constraint de exclusão do Postgres garante que não há dois horários sobrepostos. */
function ehConflitoDeHorario(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("Agendamento_sem_sobreposicao") || msg.includes("23P01");
}

async function upsertCliente(negocioId: string, dados: { nome: string; telefone: string; email?: string | null }) {
  const telefone = normalizarTelefone(dados.telefone);
  return prisma.cliente.upsert({
    where: { negocioId_telefone: { negocioId, telefone } },
    create: { negocioId, telefone, nome: dados.nome, email: dados.email || null },
    update: { nome: dados.nome, ...(dados.email ? { email: dados.email } : {}) },
  });
}

/** Entre os profissionais livres, escolhe quem tem menos atendimentos no dia (distribui a agenda). */
async function escolherProfissional(negocio: Negocio, candidatos: string[], inicio: Date): Promise<string> {
  if (candidatos.length === 1) return candidatos[0];
  const dia = ymdDe(inicio, negocio.fusoHorario);
  const deDia = instante(dia, 0, negocio.fusoHorario);
  const ateDia = instante(somarDiasYmd(dia, 1), 0, negocio.fusoHorario);
  const contagens = await Promise.all(
    candidatos.map(async (id) => ({
      id,
      total: await prisma.agendamento.count({
        where: { profissionalId: id, status: { in: [...STATUS_ATIVOS] }, inicio: { gte: deDia, lt: ateDia } },
      }),
    })),
  );
  contagens.sort((a, b) => a.total - b.total);
  return contagens[0].id;
}

/** Agendamento feito pelo cliente na página pública. */
export async function agendarOnline(
  negocio: Negocio,
  dados: {
    servicoId: string;
    profissionalId: string | null;
    inicio: string;
    nome: string;
    telefone: string;
    email?: string | null;
    observacao?: string | null;
  },
) {
  const inicio = new Date(dados.inicio);
  if (Number.isNaN(inicio.getTime())) throw new ErroAgenda("Horário inválido.");

  const servico = await prisma.servico.findFirst({ where: { id: dados.servicoId, negocioId: negocio.id, ativo: true } });
  if (!servico) throw new ErroAgenda("Serviço não encontrado.");

  const livres = await horariosDisponiveis({
    negocio,
    servicoId: servico.id,
    data: ymdDe(inicio, negocio.fusoHorario),
    profissionalId: dados.profissionalId,
  });
  const slot = livres.find((h) => h.inicio === inicio.toISOString());
  if (!slot) throw new ErroAgenda("Ops! Esse horário acabou de ser ocupado. Escolha outro, por favor.");

  const profissionalId = await escolherProfissional(negocio, slot.profissionais, inicio);
  const cliente = await upsertCliente(negocio.id, dados);

  try {
    const ag = await prisma.agendamento.create({
      data: {
        negocioId: negocio.id,
        clienteId: cliente.id,
        profissionalId,
        servicoId: servico.id,
        inicio,
        fim: new Date(inicio.getTime() + servico.duracaoMin * 60_000),
        precoCentavos: servico.precoCentavos,
        observacao: dados.observacao || null,
        status: negocio.confirmacaoAutomatica ? "CONFIRMADO" : "PENDENTE",
        origem: "ONLINE",
      },
    });
    after(() => notificar(ag.id, "NOVO_AGENDAMENTO"));
    return ag;
  } catch (e) {
    if (ehConflitoDeHorario(e)) throw new ErroAgenda("Ops! Esse horário acabou de ser ocupado. Escolha outro, por favor.");
    throw e;
  }
}

/** Agendamento lançado pelo dono no painel (cliente de balcão, telefone etc.). */
export async function agendarPeloPainel(
  negocio: Negocio,
  dados: {
    servicoId: string;
    profissionalId: string;
    inicio: Date;
    nome: string;
    telefone: string;
    observacao?: string | null;
    avisarCliente: boolean;
  },
) {
  const servico = await prisma.servico.findFirst({ where: { id: dados.servicoId, negocioId: negocio.id } });
  if (!servico) throw new ErroAgenda("Serviço não encontrado.");
  const pro = await prisma.profissional.findFirst({ where: { id: dados.profissionalId, negocioId: negocio.id } });
  if (!pro) throw new ErroAgenda("Profissional não encontrado.");

  const cliente = await upsertCliente(negocio.id, dados);
  try {
    const ag = await prisma.agendamento.create({
      data: {
        negocioId: negocio.id,
        clienteId: cliente.id,
        profissionalId: pro.id,
        servicoId: servico.id,
        inicio: dados.inicio,
        fim: new Date(dados.inicio.getTime() + servico.duracaoMin * 60_000),
        precoCentavos: servico.precoCentavos,
        observacao: dados.observacao || null,
        status: "CONFIRMADO",
        origem: "PAINEL",
      },
    });
    if (dados.avisarCliente) after(() => notificar(ag.id, "NOVO_AGENDAMENTO", { cliente: true, dono: false }));
    return ag;
  } catch (e) {
    if (ehConflitoDeHorario(e)) throw new ErroAgenda(`${pro.nome} já tem um atendimento nesse horário.`);
    throw e;
  }
}

/** Dono muda o status (confirmar, concluir, faltou, cancelar). */
export async function alterarStatus(negocioId: string, id: string, status: StatusAgendamento, motivo?: string) {
  const ag = await prisma.agendamento.findFirst({ where: { id, negocioId } });
  if (!ag) throw new ErroAgenda("Agendamento não encontrado.");
  if (ag.status === status) return ag;

  try {
    const atualizado = await prisma.agendamento.update({
      where: { id },
      data: {
        status,
        ...(status === "CANCELADO" ? { canceladoEm: new Date(), motivoCancelamento: motivo || null } : {}),
      },
    });
    if (status === "CONFIRMADO" && ag.status === "PENDENTE") {
      after(() => notificar(id, "CONFIRMACAO", { cliente: true, dono: false }));
    }
    if (status === "CANCELADO") {
      after(() => notificar(id, "CANCELAMENTO", { cliente: true, dono: false }));
    }
    return atualizado;
  } catch (e) {
    // Reativar um cancelado cujo horário já foi ocupado por outro cliente.
    if (ehConflitoDeHorario(e)) throw new ErroAgenda("Esse horário já foi ocupado por outro agendamento.");
    throw e;
  }
}

/** Cliente cancela pelo link recebido. */
export async function cancelarPeloCliente(token: string, motivo?: string) {
  const ag = await prisma.agendamento.findUnique({ where: { token }, include: { negocio: true } });
  if (!ag) throw new ErroAgenda("Agendamento não encontrado.");
  if (!STATUS_ATIVOS.includes(ag.status as (typeof STATUS_ATIVOS)[number])) {
    throw new ErroAgenda("Esse agendamento não pode mais ser cancelado.");
  }
  const limite = ag.inicio.getTime() - ag.negocio.cancelamentoAteHoras * 3_600_000;
  if (Date.now() > limite) {
    throw new ErroAgenda(
      `Cancelamentos online só até ${ag.negocio.cancelamentoAteHoras}h antes. Fale com o estabelecimento pelo WhatsApp.`,
    );
  }
  await prisma.agendamento.update({
    where: { id: ag.id },
    data: { status: "CANCELADO", canceladoEm: new Date(), motivoCancelamento: motivo || "Cancelado pelo cliente" },
  });
  after(() => notificar(ag.id, "CANCELAMENTO"));
}

/**
 * Envia lembretes para agendamentos que começam dentro da janela de cada negócio.
 * Chamado pelo cron (/api/cron/lembretes). Idempotente via lembreteEnviadoEm.
 */
export async function enviarLembretesPendentes(): Promise<number> {
  const agora = Date.now();
  const candidatos = await prisma.agendamento.findMany({
    where: {
      status: { in: [...STATUS_ATIVOS] },
      lembreteEnviadoEm: null,
      inicio: { gt: new Date(agora), lt: new Date(agora + 72 * 3_600_000) },
    },
    include: { negocio: { select: { lembreteHorasAntes: true } } },
  });

  let enviados = 0;
  for (const ag of candidatos) {
    const janela = ag.negocio.lembreteHorasAntes * 3_600_000;
    if (janela <= 0) continue;
    if (ag.inicio.getTime() - agora > janela) continue;
    // Marcado em cima da hora: a confirmação acabou de chegar, não precisa de lembrete.
    if (ag.inicio.getTime() - ag.createdAt.getTime() < 3 * 3_600_000) continue;

    const marcado = await prisma.agendamento.updateMany({
      where: { id: ag.id, lembreteEnviadoEm: null },
      data: { lembreteEnviadoEm: new Date() },
    });
    if (marcado.count === 0) continue;
    await notificar(ag.id, "LEMBRETE", { cliente: true, dono: false });
    enviados++;
  }
  return enviados;
}
