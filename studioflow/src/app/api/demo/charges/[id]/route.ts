import { simulateDemoCharge } from "@/services/server-payments";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

/** Demo only (blocked in production): pays a simulated charge. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    return respond(await simulateDemoCharge((await params).id));
  } catch (error) {
    return failure(error);
  }
}
