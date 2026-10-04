import { membershipStatus } from "@/services/server-payments";
import { tokenSchema } from "@/services/server-validation";
import { failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

/** The subscriber's own membership, read with the token on their device. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; token: string }> },
) {
  try {
    const { slug, token } = await params;
    return respond(
      await membershipStatus(
        slug,
        tokenSchema.parse(token),
        new URL(request.url).searchParams.get("check") === "1",
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
