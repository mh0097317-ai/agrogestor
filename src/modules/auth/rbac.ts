import type { Perfil } from "@prisma/client";

// Permissões de alto nível. Expandir conforme os módulos crescem.
export type Permissao =
  | "fazendas.ler"
  | "fazendas.editar"
  | "talhoes.ler"
  | "talhoes.editar"
  | "safras.ler"
  | "safras.editar"
  | "culturas.editar"
  | "financeiro.ler"
  | "config.editar";

// Perfis com acesso total.
const TOTAL: Perfil[] = ["ADMIN", "PROPRIETARIO", "GERENTE"];

const REGRAS: Record<Permissao, Perfil[]> = {
  "fazendas.ler": ["ADMIN", "PROPRIETARIO", "GERENTE", "AGRONOMO", "OPERADOR", "FINANCEIRO", "CONSULTA"],
  "fazendas.editar": TOTAL,
  "talhoes.ler": ["ADMIN", "PROPRIETARIO", "GERENTE", "AGRONOMO", "OPERADOR", "FINANCEIRO", "CONSULTA"],
  "talhoes.editar": [...TOTAL, "AGRONOMO"],
  "safras.ler": ["ADMIN", "PROPRIETARIO", "GERENTE", "AGRONOMO", "OPERADOR", "FINANCEIRO", "CONSULTA"],
  "safras.editar": [...TOTAL, "AGRONOMO"],
  "culturas.editar": [...TOTAL, "AGRONOMO"],
  "financeiro.ler": ["ADMIN", "PROPRIETARIO", "GERENTE", "FINANCEIRO"],
  "config.editar": ["ADMIN", "PROPRIETARIO"],
};

export function can(perfil: Perfil, permissao: Permissao): boolean {
  return REGRAS[permissao]?.includes(perfil) ?? false;
}
