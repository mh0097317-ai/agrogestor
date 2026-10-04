import {
  changeMembership,
  membershipActionSchema,
} from "@/services/server-payments";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    return respond(
      await changeMembership(
        membershipActionSchema.parse(await request.json()),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
