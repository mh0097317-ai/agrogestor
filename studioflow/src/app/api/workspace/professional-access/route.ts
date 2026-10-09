import {
  createProfessionalInvite,
  professionalInviteSchema,
} from "@/services/professional-access";
import {
  assertSameOrigin,
  failure,
  requestOrigin,
  respond,
} from "@/services/server-http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return respond(
      await createProfessionalInvite(
        professionalInviteSchema.parse(await request.json()),
        requestOrigin(request),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
