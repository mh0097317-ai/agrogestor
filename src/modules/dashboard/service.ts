import "server-only";
import { prisma } from "@/lib/prisma";
import { calcularIndicadores } from "@/modules/safras/service";

export async function getDashboard(tenantId: string) {
  const [fazendasCount, talhoes, safras, alertas] = await Promise.all([
    prisma.fazenda.count({ where: { tenantId, deletadoEm: null } }),
    prisma.talhao.findMany({
      where: { tenantId, deletadoEm: null },
      include: { culturaAtual: true },
    }),
    prisma.safra.findMany({
      where: { tenantId, deletadoEm: null },
      orderBy: [{ status: "asc" }, { criadoEm: "desc" }],
      include: { cultura: true, fazenda: true, etapas: { orderBy: { ordem: "asc" } }, talhoes: true },
    }),
    prisma.alerta.findMany({
      where: { tenantId },
      orderBy: { criadoEm: "desc" },
      take: 6,
    }),
  ]);

  // Safra atual: prioriza EM_ANDAMENTO; senão a mais recente.
  const safraAtual =
    safras.find((s) => s.status === "EM_ANDAMENTO") ?? safras[0] ?? null;

  const indicadores = safraAtual ? calcularIndicadores(safraAtual) : null;

  // Distribuição de área por cultura (dado real dos talhões).
  const porCultura = new Map<string, { nome: string; cor: string; area: number }>();
  let areaSemCultura = 0;
  for (const t of talhoes) {
    const area = Number(t.area);
    if (t.culturaAtual) {
      const cur = porCultura.get(t.culturaAtual.id) ?? {
        nome: t.culturaAtual.nome,
        cor: t.culturaAtual.cor ?? "#16A34A",
        area: 0,
      };
      cur.area += area;
      porCultura.set(t.culturaAtual.id, cur);
    } else {
      areaSemCultura += area;
    }
  }
  const areaTotalTalhoes = talhoes.reduce((a, t) => a + Number(t.area), 0);

  return {
    fazendasCount,
    talhoesCount: talhoes.length,
    safrasCount: safras.length,
    areaTotalTalhoes,
    safraAtual,
    indicadores,
    distribuicaoCultura: [...porCultura.values()].sort((a, b) => b.area - a.area),
    areaSemCultura,
    alertas,
  };
}
