import { getWorkspace, mutateWorkspace } from "@/services/server-store";
import { mutationSchema } from "@/services/server-validation";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function GET() {
  const started = performance.now();
  try {
    const response = respond(await getWorkspace());
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
    return respond(
      await mutateWorkspace(mutationSchema.parse(await request.json())),
    );
  } catch (error) {
    return failure(error);
  }
}
