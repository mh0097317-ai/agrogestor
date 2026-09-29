"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { TipoNegocio } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTelefone, telefoneValido } from "@/lib/utils";
import { TIPOS_NEGOCIO } from "@/lib/tipos-negocio";
import { criarNegocioComPadroes } from "@/modules/negocio/service";
import { criarSessao, encerrarSessao } from "./session";

export type EstadoForm = { erro?: string; campos?: Record<string, string> } | undefined;

const cadastroSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  senha: z.string().min(6, "A senha precisa de pelo menos 6 caracteres"),
  nomeNegocio: z.string().trim().min(2, "Informe o nome do seu negócio"),
  tipo: z.enum(Object.keys(TIPOS_NEGOCIO) as [TipoNegocio, ...TipoNegocio[]]),
  whatsapp: z.string().trim().refine(telefoneValido, "WhatsApp inválido — use DDD + número"),
});

export async function cadastrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const dados = Object.fromEntries(form) as Record<string, string>;
  const r = cadastroSchema.safeParse(dados);
  if (!r.success) return { erro: r.error.issues[0].message, campos: dados };

  const existe = await prisma.usuario.findUnique({ where: { email: r.data.email } });
  if (existe) return { erro: "Já existe uma conta com esse e-mail. Faça login.", campos: dados };

  const { negocio, usuario } = await criarNegocioComPadroes({
    nomeDono: r.data.nome,
    email: r.data.email,
    senhaHash: await bcrypt.hash(r.data.senha, 10),
    nomeNegocio: r.data.nomeNegocio,
    tipo: r.data.tipo,
    whatsapp: normalizarTelefone(r.data.whatsapp),
  });

  await criarSessao({
    usuarioId: usuario.id,
    negocioId: negocio.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
  });
  redirect("/painel?boasvindas=1");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

export async function entrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const dados = Object.fromEntries(form) as Record<string, string>;
  const r = loginSchema.safeParse(dados);
  if (!r.success) return { erro: r.error.issues[0].message, campos: dados };

  const usuario = await prisma.usuario.findUnique({ where: { email: r.data.email } });
  if (!usuario || !(await bcrypt.compare(r.data.senha, usuario.senhaHash))) {
    return { erro: "E-mail ou senha incorretos.", campos: dados };
  }

  await criarSessao({
    usuarioId: usuario.id,
    negocioId: usuario.negocioId,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
  });
  redirect("/painel");
}

export async function sair() {
  await encerrarSessao();
  redirect("/entrar");
}
