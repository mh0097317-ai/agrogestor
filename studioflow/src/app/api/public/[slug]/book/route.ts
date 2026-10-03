import { bookPublic } from "@/services/server-store";
import { bookSchema } from "@/services/server-validation";
import {
  assertSameOrigin,
  failure,
  limitPublicMutation,
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
    return respond(await bookPublic((await params).slug, input), 201);
  } catch (error) {
    return failure(error);
  }
}
