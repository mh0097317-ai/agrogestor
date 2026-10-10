import { commercialReport } from "@/services/commercial-report";
import { respond, failure } from "@/services/server-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return respond(
      await commercialReport(
        searchParams.get("from") || "",
        searchParams.get("to") || "",
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
