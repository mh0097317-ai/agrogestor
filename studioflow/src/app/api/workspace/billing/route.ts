import { auditPanel } from "@/services/activity";
import { billingView, payFee, paySchema, subscribeCard } from "@/services/billing";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

/** Mensalidade do StudioFlow: funciona mesmo com o acesso vencido. */
export async function GET() {
  try {
    return respond(await billingView());
  } catch (error) {
    return failure(error);
  }
}
/** Gera (ou devolve) a fatura em aberto, com o link de pagamento. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.mode === "card") {
      const result = await subscribeCard(paySchema.parse(body));
      auditPanel("Assinou a mensalidade no cartão");
      return respond(result);
    }
    const result = await payFee(paySchema.parse(body));
    auditPanel("Gerou a cobrança da mensalidade");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
