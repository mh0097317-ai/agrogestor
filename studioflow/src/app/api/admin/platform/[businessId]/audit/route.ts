import { z } from "zod";
import { activityPeriod } from "@/lib/platform-activity";
import { summarizeAudit } from "@/lib/audit-summary";
import { readAudit } from "@/services/activity";
import { requirePlatformAdmin } from "@/services/platform";
import { failure, respond } from "@/services/server-http";
export const dynamic = "force-dynamic";

/** Auditoria completa de um estabelecimento para a equipe StudioFlow. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    await requirePlatformAdmin();
    const businessId = z.string().uuid().parse((await params).businessId);
    const query = new URL(request.url).searchParams;
    const period = activityPeriod(query.get("from"), query.get("to"));
    const since = new Date(`${period.from}T00:00:00-03:00`).toISOString();
    const until = new Date(`${period.to}T23:59:59.999-03:00`).toISOString();
    const { activity, events } = await readAudit(businessId, since);
    const inside = (iso: string) => Date.parse(iso) <= Date.parse(until);
    return respond({
      period,
      summary: summarizeAudit(events.filter((event) => inside(event.createdAt))),
      timeline: activity.filter((row) => inside(row.createdAt)).slice(0, 300),
    });
  } catch (error) {
    return failure(error);
  }
}
