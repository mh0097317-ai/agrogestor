import { z } from "zod";
import { allModules, moduleCatalog, type ModuleKey } from "./modules";

/** Plano à venda (vitrine e /admin). Centavos; null = "sob consulta". */
export interface PlatformPlan {
  key: string;
  name: string;
  tagline: string;
  monthlyCents: number | null;
  annualCents: number | null;
  modules: ModuleKey[];
  highlight: boolean;
  active?: boolean;
  sort: number;
}

/** Mesmo conteúdo da migração; usado na demonstração e se o banco falhar. */
export const defaultPlans: PlatformPlan[] = [
  {
    key: "essencial",
    name: "Essencial",
    tagline: "Agenda online, página da casa e gestão do dia a dia.",
    monthlyCents: null,
    annualCents: null,
    modules: ["fidelidade", "espera"],
    highlight: false,
    sort: 1,
  },
  {
    key: "profissional",
    name: "Profissional",
    tagline: "Sinal no Pix, clube, produtos, check-in e Modo TV.",
    monthlyCents: null,
    annualCents: null,
    modules: ["fidelidade", "espera", "pagamentos", "clube", "produtos", "recepcao"],
    highlight: true,
    sort: 2,
  },
  {
    key: "premium",
    name: "Premium",
    tagline: "Tudo, com a recepcionista que agenda no WhatsApp.",
    monthlyCents: null,
    annualCents: null,
    modules: [...allModules],
    highlight: false,
    sort: 3,
  },
];

/** O que todo plano tem, sem depender de módulo. */
export const baseFeatures = [
  "Página da barbearia e agendamento online 24h",
  "Agenda por profissional, bloqueios e lembretes",
  "Clientes, serviços, equipe e financeiro",
  "Relatórios e divulgação (link, QR Code, story de vagas)",
];

export const moduleFeature = (key: ModuleKey) => moduleCatalog[key].label;

export function priceLabel(cents: number | null) {
  if (cents === null) return "Sob consulta";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/** Economia do anual frente a 12 mensalidades (só quando os dois existem). */
export function annualSaving(plan: Pick<PlatformPlan, "monthlyCents" | "annualCents">) {
  if (!plan.monthlyCents || plan.annualCents === null) return 0;
  return Math.max(0, plan.monthlyCents * 12 - plan.annualCents);
}

export const planInputSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]{2,30}$/),
  name: z.string().trim().min(2).max(40),
  tagline: z.string().trim().max(160),
  monthlyCents: z.number().int().min(0).max(10_000_000).nullable(),
  annualCents: z.number().int().min(0).max(100_000_000).nullable(),
  modules: z.array(z.enum(allModules as [ModuleKey, ...ModuleKey[]])).max(allModules.length),
  highlight: z.boolean(),
  active: z.boolean(),
  sort: z.number().int().min(0).max(100),
});

export const subscriptionRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("change_plan"),
    toPlan: z.string().regex(/^[a-z0-9-]{2,30}$/),
    reason: z.string().trim().max(500).default(""),
  }),
  z.object({
    kind: z.literal("cancel"),
    reason: z.string().trim().min(3, "Conte o motivo em poucas palavras.").max(500),
  }),
]);

export interface SubscriptionRequest {
  id: string;
  businessId: string;
  businessName?: string;
  kind: "change_plan" | "cancel";
  toPlan: string | null;
  reason: string;
  status: "pending" | "done" | "rejected" | "withdrawn";
  resolutionNote: string;
  createdAt: string;
  resolvedAt: string | null;
}
