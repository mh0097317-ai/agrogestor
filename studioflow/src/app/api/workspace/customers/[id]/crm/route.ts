import { auditPanel } from "@/services/activity";
import { updateCustomerCrm } from "@/services/customer-crm";
import { assertSameOrigin, failure, respond } from "@/services/server-http";

export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const body = await request.json();
    const result = await updateCustomerCrm(id, body);
    if (body?.marketingConsent !== undefined)
      auditPanel(
        body.marketingConsent ? "Registrou consentimento de mensagens" : "Registrou que o cliente não quer mensagens",
      );
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
