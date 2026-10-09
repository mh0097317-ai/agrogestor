import { auditPanel } from "@/services/activity";
import { checkFee } from "@/services/billing";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

/** "Já paguei": confere no Asaas e libera o acesso se o pagamento caiu. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const result = await checkFee();
    auditPanel("Conferiu o pagamento da mensalidade");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
