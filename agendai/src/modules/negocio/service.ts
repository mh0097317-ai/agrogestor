import "server-only";
import type { TipoNegocio } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { SERVICOS_PADRAO, SLUGS_RESERVADOS, TIPOS_NEGOCIO } from "@/lib/tipos-negocio";

/** Gera um slug livre a partir do nome ("Barbearia do Zé" → "barbearia-do-ze", "-2", ...). */
export async function slugDisponivel(nome: string, ignorarNegocioId?: string): Promise<string> {
  const base = slugify(nome) || "meu-negocio";
  for (let i = 0; i < 50; i++) {
    const candidato = i === 0 ? base : `${base}-${i + 1}`;
    if (SLUGS_RESERVADOS.has(candidato)) continue;
    const existe = await prisma.negocio.findUnique({ where: { slug: candidato }, select: { id: true } });
    if (!existe || existe.id === ignorarNegocioId) return candidato;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// Padrão: terça a sábado, 09:00–19:00.
const HORARIO_PADRAO = [2, 3, 4, 5, 6].map((diaSemana) => ({ diaSemana, inicioMin: 9 * 60, fimMin: 19 * 60 }));

export async function criarNegocioComPadroes(dados: {
  nomeDono: string;
  email: string;
  senhaHash: string;
  nomeNegocio: string;
  tipo: TipoNegocio;
  whatsapp: string;
}) {
  const slug = await slugDisponivel(dados.nomeNegocio);
  const cor = TIPOS_NEGOCIO[dados.tipo].cor;

  return prisma.$transaction(async (tx) => {
    const negocio = await tx.negocio.create({
      data: {
        slug,
        nome: dados.nomeNegocio,
        tipo: dados.tipo,
        whatsapp: dados.whatsapp,
        email: dados.email,
        corPrimaria: cor,
        horarios: { create: HORARIO_PADRAO },
      },
    });

    const usuario = await tx.usuario.create({
      data: { negocioId: negocio.id, nome: dados.nomeDono, email: dados.email, senhaHash: dados.senhaHash, papel: "DONO" },
    });

    const servicos = await Promise.all(
      SERVICOS_PADRAO[dados.tipo].map((s, ordem) =>
        tx.servico.create({
          data: {
            negocioId: negocio.id,
            nome: s.nome,
            descricao: s.descricao,
            duracaoMin: s.duracaoMin,
            precoCentavos: s.preco * 100,
            ordem,
          },
        }),
      ),
    );

    await tx.profissional.create({
      data: {
        negocioId: negocio.id,
        nome: dados.nomeDono.split(" ")[0],
        cor,
        servicos: { connect: servicos.map((s) => ({ id: s.id })) },
        jornadas: { create: HORARIO_PADRAO },
      },
    });

    return { negocio, usuario };
  });
}
