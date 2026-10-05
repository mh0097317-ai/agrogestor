import { checkFee } from "@/services/billing";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

/** "Já paguei": confere no Asaas e libera o acesso se o pagamento caiu. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return respond(await checkFee());
  } catch (error) {
    return failure(error);
  }
}
