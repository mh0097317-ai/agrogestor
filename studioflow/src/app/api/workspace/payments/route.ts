import { auditPanel } from "@/services/activity";
import { requireModule } from "@/services/modules-guard";
import {
  connectPayments,
  connectSchema,
  depositSchema,
  disconnectPayments,
  updateDeposit,
} from "@/services/server-payments";
import {
  assertSameOrigin,
  failure,
  requestOrigin,
  respond,
} from "@/services/server-http";
export const dynamic = "force-dynamic";

/** Connects the business's own Asaas account. */
export async function POST(request: Request) {
  try {
    await requireModule("pagamentos");
    assertSameOrigin(request);
    const input = connectSchema.parse(await request.json());
    const result = await connectPayments(input, requestOrigin(request));
    auditPanel("Conectou o Asaas");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
/** Deposit rules. */
export async function PATCH(request: Request) {
  try {
    await requireModule("pagamentos");
    assertSameOrigin(request);
    const result = await updateDeposit(depositSchema.parse(await request.json()));
    auditPanel("Alterou o sinal via Pix");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const result = await disconnectPayments();
    auditPanel("Desconectou o Asaas");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
