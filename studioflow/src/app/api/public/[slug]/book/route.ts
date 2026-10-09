import { after } from "next/server";
import { bookWithPayments } from "@/services/server-payments";
import { notifyNewBooking } from "@/services/whatsapp/notify";
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
  try {
    assertSameOrigin(request);
    limitPublicMutation(request);
    const input = bookSchema.parse(await request.json());
    const slug = (await params).slug;
    const appointment = await bookWithPayments(slug, input);
    // Whoever will attend gets a WhatsApp, after the answer goes back.
    const origin = requestOrigin(request);
    after(async () => {
      await notifyNewBooking(slug, appointment.id, origin);
    });
    return respond(appointment, 201);
  } catch (error) {
    return failure(error);
  }
}
