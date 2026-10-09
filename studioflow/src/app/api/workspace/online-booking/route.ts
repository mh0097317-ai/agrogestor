import { z } from "zod";
import { updateOnlineBooking } from "@/services/server-online-booking";
import { assertSameOrigin, failure, respond } from "@/services/server-http";

const schema = z.object({ onlineBookingEnabled: z.boolean() }).strict();

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    return respond(await updateOnlineBooking(input.onlineBookingEnabled));
  } catch (error) {
    return failure(error);
  }
}
