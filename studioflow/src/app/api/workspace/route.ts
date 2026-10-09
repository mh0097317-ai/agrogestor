import { getWorkspace, mutateWorkspace } from "@/services/server-store";
import { after } from "next/server";
import { notifyNewBooking } from "@/services/whatsapp/notify";
import { requestOrigin } from "@/services/server-http";
import {
  appointmentSchema,
  mutationSchema,
} from "@/services/server-validation";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
import { logActivity } from "@/services/activity";
import { describeMutation } from "@/services/activity-describe";

/** "Abriu o painel" no máximo uma vez a cada 30 minutos por pessoa. */
const opened = new Map<string, number>();
export const dynamic = "force-dynamic";
export async function GET() {
  const started = performance.now();
  try {
    const store = await getWorkspace();
    const key = `${store.business.id}:${store.viewer?.name || ""}`;
    if (Date.now() - (opened.get(key) || 0) > 30 * 60000) {
      if (opened.size > 5000) opened.clear();
      opened.set(key, Date.now());
      after(() =>
        logActivity(store.business.id, { source: "painel", action: "Abriu o painel", actor: store.viewer?.name || "" }),
      );
    }
    const response = respond(store);
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
    // Everything done in the panel goes to the StudioFlow audit.
    after(() => {
      const { action, detail } = describeMutation(input.entity, input.action, input.data, result);
      return logActivity(result.business.id, { source: "painel", action, detail, actor: result.viewer?.name || "" });
    });
    return respond(result);
  } catch (error) {
    return failure(error);
  }
}
