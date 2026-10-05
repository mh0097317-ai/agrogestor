import { timingSafeEqual } from "node:crypto";
import { markPaid } from "@/services/billing";
import { paidStatuses } from "@/services/payments/asaas";
export const dynamic = "force-dynamic";

const plain = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain" } });
const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Asaas da plataforma avisa que uma mensalidade foi paga. Conferido pelo
 * token do webhook (STUDIOFLOW_ASAAS_WEBHOOK_TOKEN) no cabeçalho.
 */
export async function POST(request: Request) {
  const expected = process.env.STUDIOFLOW_ASAAS_WEBHOOK_TOKEN || "";
  const received = request.headers.get("asaas-access-token") || "";
  if (!expected || !same(received, expected)) return plain("forbidden", 401);
  let body: { event?: string; payment?: { id?: string; status?: string } };
  try {
    body = await request.json();
  } catch {
    return plain("ok");
  }
  const id = body.payment?.id;
  const paid =
    ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(body.event || "") ||
    paidStatuses.has(body.payment?.status || "");
  if (!id || !paid) return plain("ok");
  try {
    await markPaid(id);
  } catch {
    // Asaas tries again; marking twice does nothing.
    return plain("retry", 503);
  }
  return plain("ok");
}
