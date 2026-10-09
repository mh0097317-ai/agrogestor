import { auditPanel } from "@/services/activity";
import { requireModule } from "@/services/modules-guard";
import {
  cancelSale,
  cancelSaleSchema,
  saleSchema,
  sellProducts,
} from "@/services/server-products";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireModule("produtos");
    assertSameOrigin(request);
    const result = await sellProducts(saleSchema.parse(await request.json()));
    auditPanel("Vendeu produtos");
    return respond(result, 201);
  } catch (error) {
    return failure(error);
  }
}
/** Cancelar uma venda devolve os itens ao estoque. */
export async function PATCH(request: Request) {
  try {
    await requireModule("produtos");
    assertSameOrigin(request);
    const result = await cancelSale(cancelSaleSchema.parse(await request.json()));
    auditPanel("Cancelou uma venda de produto");
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
