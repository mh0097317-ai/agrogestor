import {
  acceptProfessionalInvite,
  inviteTokenSchema,
} from "@/services/professional-access";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    return respond(
      await acceptProfessionalInvite(inviteTokenSchema.parse(body.token)),
    );
  } catch (error) {
    return failure(error);
  }
}
