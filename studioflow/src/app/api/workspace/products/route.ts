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
    assertSameOrigin(request);
    return respond(await saveProduct(productSchema.parse(await request.json())));
  } catch (error) {
    return failure(error);
  }
}
/** Arquivar ou reativar um produto. */
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    return respond(await setProductActive(productActiveSchema.parse(await request.json())));
  } catch (error) {
    return failure(error);
  }
}
