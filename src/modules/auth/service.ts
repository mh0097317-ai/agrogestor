import "server-only";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "./password";
import type { RegisterInput, LoginInput } from "./schemas";
import type { SessionPayload } from "./session";

// Culturas base criadas para todo novo tenant (dados neutros, não demonstrativos).
const CULTURAS_BASE = [
  { nome: "Soja", unidadeProducao: "sc", cicloDias: 120, cor: "#16A34A" },
  { nome: "Milho", unidadeProducao: "sc", cicloDias: 140, cor: "#D97706" },
  { nome: "Sorgo", unidadeProducao: "sc", cicloDias: 110, cor: "#B45309" },
  { nome: "Algodão", unidadeProducao: "@", cicloDias: 180, cor: "#0EA5E9" },
  { nome: "Café", unidadeProducao: "sc", cicloDias: 240, cor: "#7C2D12" },
];

export class AuthError extends Error {}

/** Cria empresa (tenant) + usuário proprietário + assinatura trial + culturas base. */
export async function registrarTenant(input: RegisterInput): Promise<SessionPayload> {
  const emailNorm = input.email.trim().toLowerCase();

  const existente = await prisma.usuario.findFirst({
    where: { email: emailNorm, deletadoEm: null },
  });
  if (existente) {
    throw new AuthError("Já existe uma conta com este e-mail.");
  }

  const senhaHash = await hashPassword(input.senha);

  const { usuario, tenant } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        nome: input.nomeEmpresa.trim(),
        plano: "TRIAL",
        assinatura: { create: { plano: "TRIAL", status: "TRIAL" } },
        culturas: { create: CULTURAS_BASE },
      },
    });

    const usuario = await tx.usuario.create({
      data: {
        tenantId: tenant.id,
        nome: input.nome.trim(),
        email: emailNorm,
        senhaHash,
        perfil: "PROPRIETARIO",
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        usuarioId: usuario.id,
        acao: "CRIAR_CONTA",
        entidade: "Tenant",
        registroId: tenant.id,
        valorNovo: { nome: tenant.nome },
      },
    });

    return { usuario, tenant };
  });

  return {
    userId: usuario.id,
    tenantId: tenant.id,
    perfil: usuario.perfil,
    nome: usuario.nome,
    email: usuario.email,
  };
}

/** Valida credenciais e devolve o payload de sessão. */
export async function autenticar(input: LoginInput): Promise<SessionPayload> {
  const emailNorm = input.email.trim().toLowerCase();
  const usuario = await prisma.usuario.findFirst({
    where: { email: emailNorm, deletadoEm: null, ativo: true },
  });
  if (!usuario) throw new AuthError("E-mail ou senha incorretos.");

  const ok = await verifyPassword(input.senha, usuario.senhaHash);
  if (!ok) throw new AuthError("E-mail ou senha incorretos.");

  return {
    userId: usuario.id,
    tenantId: usuario.tenantId,
    perfil: usuario.perfil,
    nome: usuario.nome,
    email: usuario.email,
  };
}
