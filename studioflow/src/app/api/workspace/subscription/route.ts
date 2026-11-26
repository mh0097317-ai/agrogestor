import {
  ownSubscriptionRequests,
  publicPlans,
  requestSubscriptionChange,
  withdrawSubscriptionRequest,
} from "@/services/platform-plans";
import {
  assertSameOrigin,
  failure,
  limitPublicMutation,
  respond,
} from "@/services/server-http";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const [plans, requests] = await Promise.all([
      publicPlans(),
      ownSubscriptionRequests(),
    ]);
    return respond({ plans, requests });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    limitPublicMutation(request, { scope: "subscription", max: 5 });
    return respond(await requestSubscriptionChange(await request.json()), 201);
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    await withdrawSubscriptionRequest();
    return respond({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
