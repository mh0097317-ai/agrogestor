import { auditPanel } from "@/services/activity";
import { changeExpense, createExpense, listExpenses } from "@/services/expenses";
import { DomainError } from "@/lib/availability";
import { assertSameOrigin, failure, respond } from "@/services/server-http";

export const dynamic = "force-dynamic";
const day = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    if (!day.test(from) || !day.test(to) || from > to)
      throw new DomainError("Período inválido.");
    return respond({ expenses: await listExpenses(from, to) });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const created = await createExpense(await request.json());
    auditPanel(
      "Lançou uma despesa",
      created.length > 1 ? `${created[0].description} (${created.length} meses)` : created[0]?.description,
    );
    return respond({ expenses: created }, 201);
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const item = await changeExpense(body);
    auditPanel(
      body?.action === "void" ? "Estornou uma despesa" : "Pagou uma despesa",
      item.description,
    );
    return respond({ expense: item });
  } catch (error) {
    return failure(error);
  }
}
