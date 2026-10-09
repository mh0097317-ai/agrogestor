import { auditPanel } from "@/services/activity";
import { requireModule } from "@/services/modules-guard";
import {
  productActiveSchema,
  productSchema,
  saveProduct,
  setProductActive,
} from "@/services/server-products";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireModule("produtos");
    assertSameOrigin(request);
    const result = await saveProduct(productSchema.parse(await request.json()));
    auditPanel("Salvou um produto");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
/** Arquivar ou reativar um produto. */
export async function PATCH(request: Request) {
  try {
    await requireModule("produtos");
    assertSameOrigin(request);
    const result = await setProductActive(productActiveSchema.parse(await request.json()));
    auditPanel("Ativou ou pausou um produto");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
