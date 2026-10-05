import { NextResponse } from "next/server";
import { publicCatalog } from "@/services/public-catalog";
import { failure } from "@/services/server-http";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    // Public data only: a short CDN cache keeps the page instant; prices and
    // slots are checked again on the server when booking.
    return NextResponse.json(await publicCatalog((await params).slug), {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=120" },
    });
  } catch (error) {
    return failure(error);
  }
}
