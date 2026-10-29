import { dailyReport } from "@/services/weekly-report";
import { weeklyReportPdf } from "@/services/weekly-report-pdf";
import { failure } from "@/services/server-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const report = await dailyReport(
      query.get("date") || undefined,
      query.get("professionalId") || undefined,
    );
    const bytes = await weeklyReportPdf(report);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="studioflow-diario-${report.audience}-${report.from}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
