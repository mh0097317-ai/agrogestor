import { z } from "zod";

/*
 * Despesas e DRE simplificada. Tudo em centavos inteiros: nunca somar reais
 * com ponto flutuante. A DRE é por regime de caixa (o que entrou e saiu de
 * fato no período); atendimento não fechado não entra como recebido.
 */
export const expenseCategories = {
  aluguel: "Aluguel e condomínio",
  pessoal: "Pessoal e pró-labore",
  produtos: "Produtos e insumos",
  contas: "Água, luz e internet",
  marketing: "Marketing",
  impostos: "Impostos",
  manutencao: "Manutenção",
  sistemas: "Sistemas e assinaturas",
  taxas: "Taxas de cartão e bancos",
  outros: "Outros",
} as const;
export type ExpenseCategory = keyof typeof expenseCategories;
const categoryKeys = Object.keys(expenseCategories) as [ExpenseCategory, ...ExpenseCategory[]];
const method = z.enum(["pix", "cash", "credit", "debit", "other"]);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amountCents: number;
  dueDate: string;
  paidAt: string | null;
  method: z.infer<typeof method> | null;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}

export const expenseInputSchema = z
  .object({
    category: z.enum(categoryKeys),
    description: z.string().trim().min(1, "Descreva a despesa.").max(120),
    amountCents: z.number().int().positive("Informe o valor.").max(100_000_000),
    dueDate: day,
    paid: z.boolean().default(false),
    paidAt: day.optional(),
    method: method.optional(),
    /** Repetir todo mês (aluguel, sistemas): cria os próximos lançamentos em aberto. */
    repeatMonths: z.number().int().min(0).max(11).default(0),
  })
  .strict();

export const expenseActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pay"), id: z.string().uuid(), paidAt: day, method }).strict(),
  z
    .object({
      action: z.literal("void"),
      id: z.string().uuid(),
      reason: z.string().trim().min(3, "Diga por que está estornando.").max(200),
    })
    .strict(),
]);

/** Mesmo dia do mês nos meses seguintes (31/01 vira 28 ou 29/02). */
export function monthlyDates(first: string, extra: number) {
  const [y, m, d] = first.split("-").map(Number);
  return Array.from({ length: extra }, (_, i) => {
    const target = new Date(Date.UTC(y, m - 1 + i + 1, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d, last));
    return target.toISOString().slice(0, 10);
  });
}

const within = (value: string | null, from: string, to: string) =>
  !!value && value >= from && value <= to;

/** Despesas válidas (sem estorno) pagas no período, por categoria. */
export function paidByCategory(expenses: Expense[], from: string, to: string) {
  const totals = new Map<ExpenseCategory, number>();
  for (const e of expenses)
    if (!e.voidedAt && within(e.paidAt, from, to))
      totals.set(e.category, (totals.get(e.category) || 0) + e.amountCents);
  return [...totals.entries()]
    .map(([category, cents]) => ({ category, cents }))
    .sort((a, b) => b.cents - a.cents);
}

/** Contas a pagar: em aberto e sem estorno, vencidas primeiro. */
export function payables(expenses: Expense[], today: string) {
  const open = expenses
    .filter((e) => !e.voidedAt && !e.paidAt)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    open,
    overdueCents: open.filter((e) => e.dueDate < today).reduce((s, e) => s + e.amountCents, 0),
    openCents: open.reduce((s, e) => s + e.amountCents, 0),
  };
}

export interface DreInput {
  servicesCents: number;
  productsCents: number;
  commissionCents: number;
  expenses: Expense[];
  from: string;
  to: string;
}
export function simpleDre(input: DreInput) {
  const grossCents = input.servicesCents + input.productsCents;
  const lines = paidByCategory(input.expenses, input.from, input.to);
  const expensesCents = lines.reduce((s, l) => s + l.cents, 0);
  const afterCommissionCents = grossCents - input.commissionCents;
  const resultCents = afterCommissionCents - expensesCents;
  return {
    grossCents,
    servicesCents: input.servicesCents,
    productsCents: input.productsCents,
    commissionCents: input.commissionCents,
    afterCommissionCents,
    lines,
    expensesCents,
    resultCents,
    /** Margem só existe quando entrou dinheiro. */
    margin: grossCents > 0 ? resultCents / grossCents : null,
  };
}

/** Período imediatamente anterior, do mesmo tamanho, para comparar. */
export function previousPeriod(period: { from: string; to: string }) {
  const from = Date.parse(`${period.from}T12:00:00Z`);
  const to = Date.parse(`${period.to}T12:00:00Z`);
  const days = Math.round((to - from) / 86_400_000) + 1;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { from: iso(from - days * 86_400_000), to: iso(from - 86_400_000) };
}

/** Variação percentual honesta: sem base, sem número. */
export function change(current: number, previous: number) {
  if (!previous) return null;
  return (current - previous) / Math.abs(previous);
}
