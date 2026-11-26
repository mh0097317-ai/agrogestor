import { randomUUID } from "node:crypto";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin, requireMembership } from "@/lib/supabase/server";
import {
  expenseActionSchema,
  expenseInputSchema,
  monthlyDates,
  type Expense,
} from "@/lib/expenses";
import { isDemo, mutateDemo, readDemo } from "./server-demo";

const managers = ["owner", "admin", "manager"];
const columns =
  "id,category,description,amount_cents,due_date,paid_at,method,created_at,voided_at,void_reason";
type Row = {
  id: string;
  category: Expense["category"];
  description: string;
  amount_cents: number;
  due_date: string;
  paid_at: string | null;
  method: Expense["method"];
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
};
const fromRow = (r: Row): Expense => ({
  id: r.id,
  category: r.category,
  description: r.description,
  amountCents: r.amount_cents,
  dueDate: r.due_date,
  paidAt: r.paid_at,
  method: r.method,
  createdAt: r.created_at,
  voidedAt: r.voided_at,
  voidReason: r.void_reason,
});

async function manager() {
  const member = await requireMembership();
  if (!managers.includes(member.role))
    throw new DomainError("Só a gerência vê e lança despesas.", 403);
  return member;
}
const demoManager = (store: { viewer?: { role: string } }) => {
  if (store.viewer && !managers.includes(store.viewer.role))
    throw new DomainError("Só a gerência vê e lança despesas.", 403);
};

/**
 * Lançamentos que importam para o período: vencem ou foram pagos nele, e
 * todos os que estão em aberto (contas a pagar não somem por mudar o filtro).
 */
export async function listExpenses(from: string, to: string): Promise<Expense[]> {
  if (isDemo()) {
    const store = await readDemo();
    demoManager(store);
    return (store.expenses || []).filter(
      (e) =>
        (e.dueDate >= from && e.dueDate <= to) ||
        (e.paidAt && e.paidAt >= from && e.paidAt <= to) ||
        (!e.paidAt && !e.voidedAt),
    );
  }
  const { businessId } = await manager();
  const { data, error } = await createSupabaseAdmin()
    .from("business_expenses")
    .select(columns)
    .eq("business_id", businessId)
    .or(
      `and(due_date.gte.${from},due_date.lte.${to}),and(paid_at.gte.${from},paid_at.lte.${to}),and(paid_at.is.null,voided_at.is.null)`,
    )
    .order("due_date", { ascending: false })
    .limit(500);
  if (error) throw new DomainError("Não foi possível carregar as despesas.", 503);
  return ((data || []) as Row[]).map(fromRow);
}

export async function createExpense(input: unknown) {
  const e = expenseInputSchema.parse(input);
  if (e.paid && !e.method) throw new DomainError("Diga como foi pago.");
  const paidAt = e.paid ? e.paidAt || e.dueDate : null;
  const dates = [e.dueDate, ...monthlyDates(e.dueDate, e.repeatMonths)];
  // Só o primeiro pode nascer pago; os meses seguintes ficam a pagar.
  const rows = dates.map((due, i) => ({
    category: e.category,
    description: e.description,
    amountCents: e.amountCents,
    dueDate: due,
    paidAt: i === 0 ? paidAt : null,
    method: i === 0 && paidAt ? e.method || null : null,
  }));
  if (isDemo())
    return mutateDemo((store) => {
      demoManager(store);
      const now = new Date().toISOString();
      const created: Expense[] = rows.map((r) => ({
        id: randomUUID(),
        ...r,
        createdAt: now,
        voidedAt: null,
        voidReason: null,
      }));
      store.expenses = [...(store.expenses || []), ...created].slice(-2000);
      return created;
    });
  const { businessId, user } = await manager();
  const { data, error } = await createSupabaseAdmin()
    .from("business_expenses")
    .insert(
      rows.map((r) => ({
        business_id: businessId,
        category: r.category,
        description: r.description,
        amount_cents: r.amountCents,
        due_date: r.dueDate,
        paid_at: r.paidAt,
        method: r.method,
        created_by: user.id,
      })),
    )
    .select(columns);
  if (error) throw new DomainError("Não foi possível lançar a despesa.", 503);
  return ((data || []) as Row[]).map(fromRow);
}

export async function changeExpense(input: unknown) {
  const action = expenseActionSchema.parse(input);
  const now = new Date().toISOString();
  if (isDemo())
    return mutateDemo((store) => {
      demoManager(store);
      const item = (store.expenses || []).find((e) => e.id === action.id);
      if (!item) throw new DomainError("Despesa não encontrada.", 404);
      if (item.voidedAt) throw new DomainError("Esta despesa já foi estornada.", 409);
      if (action.action === "pay") {
        if (item.paidAt) throw new DomainError("Esta despesa já está paga.", 409);
        item.paidAt = action.paidAt;
        item.method = action.method;
      } else {
        item.voidedAt = now;
        item.voidReason = action.reason;
      }
      return item;
    });
  const { businessId } = await manager();
  let query = createSupabaseAdmin()
    .from("business_expenses")
    .update(
      action.action === "pay"
        ? { paid_at: action.paidAt, method: action.method, updated_at: now }
        : { voided_at: now, void_reason: action.reason, updated_at: now },
    )
    .eq("business_id", businessId)
    .eq("id", action.id)
    .is("voided_at", null);
  // Pagar duas vezes não pode trocar a data do primeiro pagamento.
  if (action.action === "pay") query = query.is("paid_at", null);
  const { data, error } = await query.select(columns).maybeSingle();
  if (error) throw new DomainError("Não foi possível salvar.", 503);
  if (!data)
    throw new DomainError("Esta despesa já foi paga, estornada ou não existe.", 409);
  return fromRow(data as Row);
}
