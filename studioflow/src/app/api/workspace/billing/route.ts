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
    return respond(await payFee(paySchema.parse(await request.json().catch(() => ({})))));
  } catch (error) {
    return failure(error);
  }
}
