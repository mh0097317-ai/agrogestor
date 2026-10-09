import { auditPanel } from "@/services/activity";
import { billingView, payFee, paySchema } from "@/services/billing";
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
    const result = await payFee(paySchema.parse(await request.json().catch(() => ({}))));
    auditPanel("Gerou a cobrança da mensalidade");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
