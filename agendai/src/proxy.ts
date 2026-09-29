import { NextResponse, type NextRequest } from "next/server";

// Checagem otimista: sem cookie de sessão, nem renderiza o painel.
// A validação real (assinatura do JWT) acontece em exigirSessao().
export function proxy(req: NextRequest) {
  if (!req.cookies.has("agendai_sessao")) {
    return NextResponse.redirect(new URL("/entrar", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*"],
};
