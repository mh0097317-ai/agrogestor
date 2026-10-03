import { getPublicStore } from "@/services/server-store";
import { availableSlots, DomainError } from "@/lib/availability";
import { failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const query = new URL(request.url).searchParams,
      month = query.get("month") || "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      throw new DomainError("Mês inválido.");
    const store = await getPublicStore((await params).slug);
    const dates = Array.from(
      {
        length: new Date(
          Number(month.slice(0, 4)),
          Number(month.slice(5, 7)),
          0,
        ).getDate(),
      },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    );
    return respond(
      dates.map((date) => ({
        date,
        slots: availableSlots(
          store,
          (query.get("serviceId") || "").split(","),
          query.get("professionalId") || "any",
          date,
        ),
      })),
    );
  } catch (error) {
    return failure(error);
  }
}
