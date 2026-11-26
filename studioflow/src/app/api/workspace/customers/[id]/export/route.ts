import { auditPanel } from "@/services/activity";
import { exportCustomerData } from "@/services/customer-crm";
import { failure } from "@/services/server-http";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const data = await exportCustomerData(id);
    auditPanel("Exportou os dados de um cliente (LGPD)");
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="dados-cliente-${id.slice(0, 8)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
