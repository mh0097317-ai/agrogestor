import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO } from "@/modules/auth/session";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/entrar", req.url));
  res.cookies.delete(COOKIE_SESSAO);
  return res;
}
