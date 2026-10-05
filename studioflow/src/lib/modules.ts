import { DomainError } from "./availability";
import type { Store } from "@/types";

/**
 * Módulos que a equipe StudioFlow liga por cliente. Agenda, clientes,
 * serviços, equipe, financeiro, relatórios e divulgação são a base e
 * estão sempre incluídos.
 */
export const moduleCatalog = {
  pagamentos: {
    label: "Sinal via Pix",
    detail: "Cobra um sinal no agendamento pelo Asaas do estabelecimento.",
  },
  clube: {
    label: "Clube de assinatura",
    detail: "Planos mensais com serviços inclusos.",
  },
  recepcionista: {
    label: "Recepcionista com IA",
    detail: "Chat da página, WhatsApp e Instagram, com áudio.",
  },
  produtos: {
    label: "Venda de produtos",
    detail: "Estoque, venda no balcão e vitrine na página.",
  },
  recepcao: {
    label: "Check-in e Modo TV",
    detail: "QR Code na recepção e tela para a TV da casa.",
  },
  fidelidade: {
    label: "Cartão fidelidade",
    detail: "Prêmio a cada tantos atendimentos.",
  },
  espera: {
    label: "Lista de espera",
    detail: "Dias lotados avisam quando abre vaga.",
  },
} as const;
export type ModuleKey = keyof typeof moduleCatalog;
export const allModules = Object.keys(moduleCatalog) as ModuleKey[];

/** Planos prontos para fechar com o cliente; dá para ajustar módulo a módulo. */
export const planCatalog = {
  essencial: {
    label: "Essencial",
    modules: ["fidelidade", "espera"] as ModuleKey[],
  },
  profissional: {
    label: "Profissional",
    modules: ["fidelidade", "espera", "pagamentos", "clube", "produtos", "recepcao"] as ModuleKey[],
  },
  premium: {
    label: "Premium",
    modules: allModules,
  },
} as const;
export type PlanKey = keyof typeof planCatalog;

/** null = todos os módulos (quem já usava antes dos planos). */
export function enabledModules(modules?: string[] | null): ModuleKey[] {
  if (!modules) return allModules;
  return allModules.filter((key) => modules.includes(key));
}
export function hasModule(modules: string[] | null | undefined, key: ModuleKey) {
  return enabledModules(modules).includes(key);
}
/** Nome do plano que bate com os módulos, ou "Personalizado". */
export function planFor(modules: string[] | null | undefined) {
  const list = enabledModules(modules).slice().sort().join(",");
  for (const [key, plan] of Object.entries(planCatalog))
    if (plan.modules.slice().sort().join(",") === list) return key as PlanKey;
  return null;
}
export function assertModule(modules: string[] | null | undefined, key: ModuleKey) {
  if (!hasModule(modules, key))
    throw new DomainError(
      `${moduleCatalog[key].label} não está incluído no plano deste estabelecimento.`,
      403,
    );
}

/**
 * Desliga no próprio cadastro o que o plano não inclui, para que página
 * pública, agendamento e atendente sigam as mesmas regras sem exceções.
 */
export function applyModules(store: Store, modules: string[] | null | undefined): Store {
  const on = (key: ModuleKey) => hasModule(modules, key);
  const settings = { ...store.settings };
  if (!on("pagamentos")) settings.depositMode = "off";
  if (!on("recepcionista")) settings.assistantEnabled = false;
  if (!on("fidelidade")) settings.loyaltyEnabled = false;
  return {
    ...store,
    settings,
    plans: on("clube") ? store.plans : [],
    memberships: on("clube") ? store.memberships : [],
    products: on("produtos") ? store.products : [],
    productSales: on("produtos") ? store.productSales : [],
    waitlist: on("espera") ? store.waitlist : [],
  };
}
