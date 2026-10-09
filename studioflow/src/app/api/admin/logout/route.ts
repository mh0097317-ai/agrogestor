import { NextResponse } from "next/server";
import { createPlatformServer } from "@/services/server-platform-auth";
import {
  assertSameOrigin,
  failure,
  requestOrigin,
} from "@/services/server-http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const client = await createPlatformServer();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
    const response = NextResponse.redirect(
      new URL("/admin/login", requestOrigin(request)),
      303,
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (cause) {
    return failure(cause);
  }
}
