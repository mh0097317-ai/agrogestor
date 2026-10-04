import {
  changeWaitlist,
  waitlistRemoveSchema,
  waitlistUpdateSchema,
} from "@/services/server-growth";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    return respond(
      await changeWaitlist(
        "update",
        waitlistUpdateSchema.parse(await request.json()),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    return respond(
      await changeWaitlist(
        "remove",
        waitlistRemoveSchema.parse(await request.json()),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
