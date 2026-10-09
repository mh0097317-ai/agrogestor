import { after } from "next/server";
import { bookWithPayments } from "@/services/server-payments";
import { notifyNewBooking } from "@/services/whatsapp/notify";
import { activityWhen, logActivity } from "@/services/activity";
import { businessIdForSlug } from "@/services/server-store";
import { DomainError } from "@/lib/availability";
import { bookSchema } from "@/services/server-validation";
import {
  assertSameOrigin,
  failure,
  limitPublicMutation,
  requestOrigin,
  respond,
} from "@/services/server-http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const slug = (await params).slug;
  try {
    assertSameOrigin(request);
    limitPublicMutation(request);
    const input = bookSchema.parse(await request.json());
    const appointment = await bookWithPayments(slug, input);
    // Whoever will attend gets a WhatsApp, after the answer goes back.
    const origin = requestOrigin(request);
    after(async () => {
      await notifyNewBooking(slug, appointment.id, origin);
    });
    after(() =>
      logActivity(appointment.businessId, {
        source: "cliente",
        action: appointment.depositStatus === "pending" ? "Reservou e foi pagar o sinal" : "Agendou pela página",
        detail: `${appointment.customerName} · ${activityWhen(appointment.start)}`,
        actor: appointment.customerName,
      }),
    );
    return respond(appointment, 201);
  } catch (error) {
    // Who tried and could not book also goes to the audit.
    if (error instanceof DomainError && error.status !== 429)
      after(async () => {
        const businessId = await businessIdForSlug(slug);
        if (businessId)
          await logActivity(businessId, { source: "cliente", action: "Não conseguiu agendar", detail: error.message });
      });
    return failure(error);
  }
}
