import { getWorkspace, mutateWorkspace } from "@/services/server-store";
import { after } from "next/server";
import { notifyNewBooking } from "@/services/whatsapp/notify";
import { requestOrigin } from "@/services/server-http";
import {
  appointmentSchema,
  mutationSchema,
} from "@/services/server-validation";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function GET() {
  const started = performance.now();
  try {
    const response = respond(await getWorkspace());
    response.headers.set(
      "Server-Timing",
      `workspace;dur=${(performance.now() - started).toFixed(1)}`,
    );
    return response;
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = mutationSchema.parse(await request.json());
    const before =
      input.entity === "appointments" && input.action === "create"
        ? await getWorkspace()
        : null;
    const result = await mutateWorkspace(input);
    if (before) {
      const created = appointmentSchema.parse(input.data);
      const appointment = result.appointments.find(
        (a) =>
          !before.appointments.some((old) => old.id === a.id) &&
          a.professionalId === created.professionalId &&
          new Date(a.start).getTime() === new Date(created.start).getTime() &&
          a.customerPhone === created.customerPhone,
      );
      if (appointment)
        after(async () => {
          await notifyNewBooking(
            result.business.slug,
            appointment.id,
            requestOrigin(request),
          );
        });
    }
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
