"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { StatusAgendamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/modules/auth/guard";
import { agendarPeloPainel, alterarStatus, ErroAgenda } from "@/modules/agenda/service";
import { slugDisponivel } from "@/modules/negocio/service";
import { horaParaMin, instante } from "@/lib/tempo";
import { normalizarTelefone, parsePreco, slugify, telefoneValido } from "@/lib/utils";
import { SLUGS_RESERVADOS } from "@/lib/tipos-negocio";

export type Resultado = { ok?: boolean; erro?: string };

function falha(e: unknown): Resultado {
  if (e instanceof ErroAgenda) return { erro: e.message };
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  console.error(e);
  return { erro: "Algo deu errado. Tente novamente." };
}

function revalidarPainel() {
  revalidatePath("/painel", "layout");
}

// ---------------- Agendamentos ----------------

export async function mudarStatus(id: string, status: StatusAgendamento, motivo?: string): Promise<Resultado> {
  const { negocio } = await exigirSessao();
  try {
    await alterarStatus(negocio.id, id, status, motivo);
    revalidarPainel();
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

const novoAgendamentoSchema = z.object({
  servicoId: z.string().min(1, "Escolha o serviço"),
  profissionalId: z.string().min(1, "Escolha o profissional"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  nome: z.string().trim().min(2, "Informe o nome do cliente"),
  telefone: z.string().trim().refine(telefoneValido, "WhatsApp do cliente inválido"),
  observacao: z.string().trim().max(300).optional(),
  avisarCliente: z.boolean(),
});

export async function criarAgendamento(dados: z.input<typeof novoAgendamentoSchema>): Promise<Resultado> {
  const { negocio } = await exigirSessao();
  try {
    const d = novoAgendamentoSchema.parse(dados);
    await agendarPeloPainel(negocio, {
      ...d,
      inicio: instante(d.data, horaParaMin(d.hora), negocio.fusoHorario),
    });
    revalidarPainel();
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

// ---------------- Serviços ----------------

const servicoSchema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(2, "Informe o nome do serviço"),
  descricao: z.string().trim().max(200).optional(),
  duracaoMin: z.coerce.number().int().min(5, "Duração mínima: 5 min").max(600),
  preco: z.string(),
  ativo: z.boolean(),
});

export async function salvarServico(dados: z.input<typeof servicoSchema>): Promise<Resultado> {
  const { negocio } = await exigirSessao();
  try {
    const d = servicoSchema.parse(dados);
    const campos = {
      nome: d.nome,
      descricao: d.descricao || null,
      duracaoMin: d.duracaoMin,
      precoCentavos: parsePreco(d.preco),
      ativo: d.ativo,
    };
    if (d.id) {
      await prisma.servico.updateMany({ where: { id: d.id, negocioId: negocio.id }, data: campos });
    } else {
      const total = await prisma.servico.count({ where: { negocioId: negocio.id } });
      const pros = await prisma.profissional.findMany({ where: { negocioId: negocio.id, ativo: true }, select: { id: true } });
      await prisma.servico.create({
        data: { ...campos, negocioId: negocio.id, ordem: total, profissionais: { connect: pros } },
      });
    }
    revalidarPainel();
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

export async function excluirServico(id: string): Promise<Resultado> {
  const { negocio } = await exigirSessao();
  const usados = await prisma.agendamento.count({ where: { servicoId: id, negocioId: negocio.id } });
  if (usados > 0) {
    // Mantém o histórico: só desativa.
    await prisma.servico.updateMany({ where: { id, negocioId: negocio.id }, data: { ativo: false } });
  } else {
    await prisma.servico.deleteMany({ where: { id, negocioId: negocio.id } });
  }
  revalidarPainel();
  return { ok: true };
}

// ---------------- Equipe ----------------

const faixaSchema = z.object({ diaSemana: z.number().int().min(0).max(6), inicio: z.string(), fim: z.string() });

function validarFaixas(faixas: z.infer<typeof faixaSchema>[]) {
  return faixas.map((f) => {
    const inicioMin = horaParaMin(f.inicio);
    const fimMin = horaParaMin(f.fim);
    if (!(fimMin > inicioMin)) throw new ErroAgenda("Em cada faixa de horário, o fim precisa ser depois do início.");
    return { diaSemana: f.diaSemana, inicioMin, fimMin };
  });
}

const profissionalSchema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(2, "Informe o nome"),
  bio: z.string().trim().max(160).optional(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  ativo: z.boolean(),
  servicos: z.array(z.string()),
  jornada: z.array(faixaSchema),
});

export async function salvarProfissional(dados: z.input<typeof profissionalSchema>): Promise<Resultado> {
  const { negocio } = await exigirSessao();
  try {
    const d = profissionalSchema.parse(dados);
    const jornadas = validarFaixas(d.jornada);
    const servicosValidos = await prisma.servico.findMany({
      where: { negocioId: negocio.id, id: { in: d.servicos } },
      select: { id: true },
    });
    const campos = { nome: d.nome, bio: d.bio || null, cor: d.cor, ativo: d.ativo };

    if (d.id) {
      const existe = await prisma.profissional.findFirst({ where: { id: d.id, negocioId: negocio.id } });
      if (!existe) throw new ErroAgenda("Profissional não encontrado.");
      await prisma.$transaction([
        prisma.jornada.deleteMany({ where: { profissionalId: d.id } }),
        prisma.profissional.update({
          where: { id: d.id },
          data: { ...campos, servicos: { set: servicosValidos }, jornadas: { create: jornadas } },
        }),
      ]);
    } else {
      const total = await prisma.profissional.count({ where: { negocioId: negocio.id } });
      await prisma.profissional.create({
        data: { ...campos, negocioId: negocio.id, ordem: total, servicos: { connect: servicosValidos }, jornadas: { create: jornadas } },
      });
    }
    revalidarPainel();
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

export async function excluirProfissional(id: string): Promise<Resultado> {
  const { negocio } = await exigirSessao();
  const futuros = await prisma.agendamento.count({
    where: { profissionalId: id, negocioId: negocio.id, inicio: { gt: new Date() }, status: { in: ["PENDENTE", "CONFIRMADO"] } },
  });
  if (futuros > 0) return { erro: `Esse profissional tem ${futuros} agendamento(s) futuro(s). Cancele ou remaneje antes.` };
  const historico = await prisma.agendamento.count({ where: { profissionalId: id, negocioId: negocio.id } });
  if (historico > 0) {
    await prisma.profissional.updateMany({ where: { id, negocioId: negocio.id }, data: { ativo: false } });
  } else {
    await prisma.profissional.deleteMany({ where: { id, negocioId: negocio.id } });
  }
  revalidarPainel();
  return { ok: true };
}

// ---------------- Configurações ----------------

const configSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do negócio"),
  slug: z.string().trim(),
  descricao: z.string().trim().max(240).optional(),
  whatsapp: z.string().trim().refine((v) => !v || telefoneValido(v), "WhatsApp inválido"),
  email: z.union([z.literal(""), z.string().trim().email("E-mail inválido")]),
  endereco: z.string().trim().max(160).optional(),
  cidade: z.string().trim().max(80).optional(),
  instagram: z.string().trim().max(60).optional(),
  corPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
  antecedenciaMinutos: z.coerce.number().int().min(0).max(10080),
  janelaDias: z.coerce.number().int().min(1).max(180),
  intervaloSlotMinutos: z.coerce.number().int().min(5).max(120),
  cancelamentoAteHoras: z.coerce.number().int().min(0).max(168),
  lembreteHorasAntes: z.coerce.number().int().min(0).max(72),
  confirmacaoAutomatica: z.boolean(),
  notificarDonoWhatsapp: z.boolean(),
  notificarDonoEmail: z.boolean(),
  notificarClienteWhatsapp: z.boolean(),
  notificarClienteEmail: z.boolean(),
  horarios: z.array(faixaSchema),
});

export async function salvarConfiguracoes(dados: z.input<typeof configSchema>): Promise<Resultado & { slug?: string }> {
  const { negocio } = await exigirSessao();
  try {
    const { horarios, ...d } = configSchema.parse(dados);
    const faixas = validarFaixas(horarios);

    let slug = slugify(d.slug || d.nome);
    if (!slug) throw new ErroAgenda("Link inválido.");
    if (SLUGS_RESERVADOS.has(slug)) throw new ErroAgenda("Esse link é reservado. Escolha outro.");
    if (slug !== negocio.slug) {
      const livre = await slugDisponivel(slug, negocio.id);
      if (livre !== slug) throw new ErroAgenda(`O link "${slug}" já está em uso. Que tal "${livre}"?`);
      slug = livre;
    }

    await prisma.$transaction([
      prisma.horarioFuncionamento.deleteMany({ where: { negocioId: negocio.id } }),
      prisma.negocio.update({
        where: { id: negocio.id },
        data: {
          ...d,
          slug,
          descricao: d.descricao || null,
          whatsapp: d.whatsapp ? normalizarTelefone(d.whatsapp) : null,
          email: d.email || null,
          endereco: d.endereco || null,
          cidade: d.cidade || null,
          instagram: d.instagram?.replace(/^@/, "") || null,
          horarios: { create: faixas },
        },
      }),
    ]);
    revalidarPainel();
    revalidatePath(`/${slug}`);
    return { ok: true, slug };
  } catch (e) {
    return falha(e);
  }
}

// ---------------- Bloqueios (folgas/feriados) ----------------

const bloqueioSchema = z.object({
  profissionalId: z.string().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  diaInteiro: z.boolean(),
  inicio: z.string().optional(),
  fim: z.string().optional(),
  motivo: z.string().trim().max(80).optional(),
});

export async function criarBloqueio(dados: z.input<typeof bloqueioSchema>): Promise<Resultado> {
  const { negocio } = await exigirSessao();
  try {
    const d = bloqueioSchema.parse(dados);
    const fuso = negocio.fusoHorario;
    const ini = d.diaInteiro ? 0 : horaParaMin(d.inicio ?? "00:00");
    const fim = d.diaInteiro ? 24 * 60 : horaParaMin(d.fim ?? "23:59");
    if (fim <= ini) throw new ErroAgenda("O fim precisa ser depois do início.");
    if (d.profissionalId) {
      const pro = await prisma.profissional.findFirst({ where: { id: d.profissionalId, negocioId: negocio.id } });
      if (!pro) throw new ErroAgenda("Profissional não encontrado.");
    }
    await prisma.bloqueio.create({
      data: {
        negocioId: negocio.id,
        profissionalId: d.profissionalId || null,
        inicio: instante(d.data, ini, fuso),
        fim: instante(d.data, fim, fuso),
        motivo: d.motivo || null,
      },
    });
    revalidarPainel();
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

export async function excluirBloqueio(id: string): Promise<Resultado> {
  const { negocio } = await exigirSessao();
  await prisma.bloqueio.deleteMany({ where: { id, negocioId: negocio.id } });
  revalidarPainel();
  return { ok: true };
}

// ---------------- Avisos ----------------

export async function marcarAvisosLidos(): Promise<Resultado> {
  const { negocio } = await exigirSessao();
  await prisma.notificacao.updateMany({
    where: { negocioId: negocio.id, canal: "PAINEL", lida: false },
    data: { lida: true },
  });
  revalidarPainel();
  return { ok: true };
}
