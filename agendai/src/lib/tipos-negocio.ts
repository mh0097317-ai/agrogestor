import type { TipoNegocio } from "@prisma/client";

export const TIPOS_NEGOCIO: Record<TipoNegocio, { rotulo: string; cor: string; emoji: string }> = {
  BARBEARIA: { rotulo: "Barbearia", cor: "#C8872E", emoji: "💈" },
  SALAO_MASCULINO: { rotulo: "Salão masculino", cor: "#2F6FDE", emoji: "✂️" },
  SALAO_FEMININO: { rotulo: "Salão feminino", cor: "#D94680", emoji: "💇‍♀️" },
  SALAO_UNISSEX: { rotulo: "Salão unissex", cor: "#7B5CE0", emoji: "💇" },
  ESTETICA: { rotulo: "Estética", cor: "#16A085", emoji: "✨" },
  MANICURE: { rotulo: "Manicure & Pedicure", cor: "#E4572E", emoji: "💅" },
  OUTRO: { rotulo: "Outro", cor: "#E4572E", emoji: "📅" },
};

type ServicoPadrao = { nome: string; duracaoMin: number; preco: number; descricao?: string };

/** Serviços sugeridos ao criar a conta — o dono ajusta depois. */
export const SERVICOS_PADRAO: Record<TipoNegocio, ServicoPadrao[]> = {
  BARBEARIA: [
    { nome: "Corte masculino", duracaoMin: 30, preco: 45, descricao: "Máquina e tesoura, acabamento na navalha" },
    { nome: "Barba", duracaoMin: 30, preco: 35, descricao: "Toalha quente, navalha e hidratação" },
    { nome: "Corte + Barba", duracaoMin: 60, preco: 70, descricao: "O combo completo" },
    { nome: "Pezinho", duracaoMin: 15, preco: 15 },
    { nome: "Sobrancelha", duracaoMin: 15, preco: 15 },
    { nome: "Pigmentação", duracaoMin: 45, preco: 50 },
  ],
  SALAO_MASCULINO: [
    { nome: "Corte masculino", duracaoMin: 30, preco: 40 },
    { nome: "Corte infantil", duracaoMin: 30, preco: 35 },
    { nome: "Barba", duracaoMin: 30, preco: 30 },
    { nome: "Luzes / Platinado", duracaoMin: 120, preco: 150 },
    { nome: "Hidratação", duracaoMin: 30, preco: 40 },
  ],
  SALAO_FEMININO: [
    { nome: "Corte feminino", duracaoMin: 60, preco: 90 },
    { nome: "Escova", duracaoMin: 45, preco: 60 },
    { nome: "Coloração", duracaoMin: 120, preco: 180 },
    { nome: "Mechas / Luzes", duracaoMin: 180, preco: 350 },
    { nome: "Hidratação", duracaoMin: 45, preco: 80 },
    { nome: "Manicure", duracaoMin: 45, preco: 35 },
    { nome: "Pedicure", duracaoMin: 45, preco: 40 },
    { nome: "Design de sobrancelha", duracaoMin: 30, preco: 40 },
  ],
  SALAO_UNISSEX: [
    { nome: "Corte masculino", duracaoMin: 30, preco: 45 },
    { nome: "Corte feminino", duracaoMin: 60, preco: 90 },
    { nome: "Escova", duracaoMin: 45, preco: 60 },
    { nome: "Barba", duracaoMin: 30, preco: 35 },
    { nome: "Coloração", duracaoMin: 120, preco: 180 },
    { nome: "Hidratação", duracaoMin: 45, preco: 80 },
  ],
  ESTETICA: [
    { nome: "Limpeza de pele", duracaoMin: 60, preco: 150 },
    { nome: "Design de sobrancelha", duracaoMin: 30, preco: 45 },
    { nome: "Depilação", duracaoMin: 30, preco: 60 },
    { nome: "Massagem relaxante", duracaoMin: 60, preco: 130 },
  ],
  MANICURE: [
    { nome: "Manicure", duracaoMin: 45, preco: 35 },
    { nome: "Pedicure", duracaoMin: 45, preco: 40 },
    { nome: "Pé + Mão", duracaoMin: 90, preco: 70 },
    { nome: "Alongamento em gel", duracaoMin: 120, preco: 160 },
    { nome: "Esmaltação em gel", duracaoMin: 60, preco: 70 },
  ],
  OUTRO: [
    { nome: "Atendimento", duracaoMin: 30, preco: 50 },
    { nome: "Atendimento longo", duracaoMin: 60, preco: 90 },
  ],
};

/** Slugs que não podem ser usados por negócios (colidem com rotas do app). */
export const SLUGS_RESERVADOS = new Set([
  "api", "painel", "entrar", "cadastro", "sair", "agendamento", "a", "admin", "app",
  "login", "_next", "favicon.ico", "robots.txt", "sitemap.xml", "precos", "sobre", "termos", "privacidade",
]);
