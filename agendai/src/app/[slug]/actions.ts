"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { telefoneValido } from "@/lib/utils";
import { agendarOnline, ErroAgenda } from "@/modules/agenda/service";

const schema = z.object({
  servicoId: z.string().min(1),
  profissionalId: z.string().nullable(),
  inicio: z.string().min(1),
  nome: z.string().trim().min(2, "Informe seu nome"),
  telefone: z.string().trim().refine(telefoneValido, "WhatsApp inválido — use DDD + número"),
  email: z.union([z.literal(""), z.string().trim().email("E-mail inválido")]).optional(),
  observacao: z.string().trim().max(300).optional(),
});

export type ResultadoAgendar = { ok: true; token: string } | { ok: false; erro: string; ocupado?: boolean };

export async function agendar(slug: string, entrada: z.input<typeof schema>): Promise<ResultadoAgendar> {
  const r = schema.safeParse(entrada);
  if (!r.success) return { ok: false, erro: r.error.issues[0].message };

  const negocio = await prisma.negocio.findUnique({ where: { slug } });
  if (!negocio || !negocio.ativo) return { ok: false, erro: "Estabelecimento não encontrado." };

  try {
    const ag = await agendarOnline(negocio, r.data);
    return { ok: true, token: ag.token };
  } catch (e) {
    if (e instanceof ErroAgenda) return { ok: false, erro: e.message, ocupado: e.message.includes("ocupado") };
    console.error(e);
    return { ok: false, erro: "Não foi possível agendar agora. Tente novamente." };
  }
}
