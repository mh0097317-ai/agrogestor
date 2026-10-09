import {
  platformAction,
  platformActionSchema,
  platformOverview,
  platformPlan,
  platformPlanSchema,
  requirePlatformAdmin,
  platformChannel,
  platformChannelSchema,
  platformIntegrations,
} from "@/services/platform";
import { activityPeriod } from "@/lib/platform-activity";
import { platformMonitoring } from "@/services/platform-monitoring";
import { assertSameOrigin, failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

async function view(request: Request) {
  const query = new URL(request.url).searchParams;
  const period = activityPeriod(query.get("from"), query.get("to"));
  await requirePlatformAdmin();
  const [businesses, monitoring] = await Promise.allSettled([
    platformOverview(new Date(), period),
    platformMonitoring(period),
  ]);
  if (businesses.status === "rejected") throw businesses.reason;
  if (monitoring.status === "rejected")
    console.error("StudioFlow admin monitoring unavailable");
  return {
    businesses: businesses.value,
    monitoring: monitoring.status === "fulfilled" ? monitoring.value : null,
    monitoringError:
      monitoring.status === "rejected"
        ? "Não foi possível consultar cobranças e histórico. Atualize para tentar novamente."
        : "",
    period,
    integrations: await platformIntegrations(),
  };
}
export async function GET(request: Request) {
  try {
    return respond(await view(request));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requirePlatformAdmin();
    await platformAction(platformActionSchema.parse(await request.json()));
    return respond(await view(request));
  } catch (error) {
    return failure(error);
  }
}
/** Plano, mensalidade e módulos do estabelecimento. */
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    await requirePlatformAdmin();
    await platformPlan(platformPlanSchema.parse(await request.json()));
    return respond(await view(request));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    await requirePlatformAdmin();
    await platformChannel(platformChannelSchema.parse(await request.json()));
    return respond(await view(request));
  } catch (error) {
    return failure(error);
  }
}
