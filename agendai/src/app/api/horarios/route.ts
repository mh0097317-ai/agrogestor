import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { horariosDisponiveis } from "@/modules/agenda/disponibilidade";

// GET /api/horarios?negocio=slug&servico=id&data=YYYY-MM-DD[&profissional=id]
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const slug = p.get("negocio");
  const servicoId = p.get("servico");
  const data = p.get("data");
  if (!slug || !servicoId || !data) {
    return NextResponse.json({ erro: "Parâmetros obrigatórios: negocio, servico, data" }, { status: 400 });
  }
  const negocio = await prisma.negocio.findUnique({ where: { slug } });
  if (!negocio || !negocio.ativo) return NextResponse.json({ erro: "Negócio não encontrado" }, { status: 404 });

  const horarios = await horariosDisponiveis({
    negocio,
    servicoId,
    data,
    profissionalId: p.get("profissional") || null,
  });
  return NextResponse.json({ horarios }, { headers: { "Cache-Control": "no-store" } });
}
