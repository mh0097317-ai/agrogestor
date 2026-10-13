import { platformWeeklyReport } from "@/services/platform-weekly-report";
import { weeklyReportPdf } from "@/services/weekly-report-pdf";
import { failure } from "@/services/server-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const report = await platformWeeklyReport(
      new URL(request.url).searchParams.get("week") || undefined,
    );
    return new Response(new Uint8Array(await weeklyReportPdf(report)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="studioflow-semanal-plataforma-${report.from}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
