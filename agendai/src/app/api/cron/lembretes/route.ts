import { NextResponse, type NextRequest } from "next/server";
import { enviarLembretesPendentes } from "@/modules/agenda/service";

// Chamado periodicamente (Vercel Cron ou qualquer agendador externo).
// Autenticação: header "Authorization: Bearer <CRON_SECRET>" (padrão da Vercel) ou ?chave=<CRON_SECRET>.
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const enviado = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.nextUrl.searchParams.get("chave");
  if (!segredo || enviado !== segredo) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }
  const enviados = await enviarLembretesPendentes();
  return NextResponse.json({ ok: true, lembretes: enviados });
}
