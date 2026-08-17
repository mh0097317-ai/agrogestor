/**
 * Seed do Agrogestor.
 *
 * Dados DEMONSTRATIVOS, claramente separados dos dados reais do usuário.
 * Só roda quando SEED_DEMO=true. Cria um tenant de demonstração isolado
 * (login: demo@agrogestor.local / demo123) reproduzindo a Fazenda Santa Clara.
 *
 * NUNCA usar estes dados como se fossem reais.
 */
import { PrismaClient, type Perfil } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_EMAIL = "demo@agrogestor.local";

async function main() {
  if (process.env.SEED_DEMO !== "true") {
    console.log("SEED_DEMO != true — nada a semear.");
    return;
  }

  // Idempotente: remove tenant demo anterior (cascade limpa tudo).
  const existente = await prisma.usuario.findFirst({ where: { email: DEMO_EMAIL } });
  if (existente) {
    await prisma.tenant.delete({ where: { id: existente.tenantId } });
    console.log("Tenant demo anterior removido.");
  }

  const senhaHash = await bcrypt.hash("demo123", 10);

  const tenant = await prisma.tenant.create({
    data: {
      nome: "Agropecuária Santa Clara (DEMO)",
      plano: "PRO",
      assinatura: { create: { plano: "PRO", status: "ATIVA" } },
      usuarios: {
        create: {
          nome: "Matheus H.",
          email: DEMO_EMAIL,
          senhaHash,
          perfil: "PROPRIETARIO" as Perfil,
        },
      },
      culturas: {
        create: [
          { nome: "Soja", unidadeProducao: "sc", cicloDias: 120, cor: "#16A34A" },
          { nome: "Milho", unidadeProducao: "sc", cicloDias: 140, cor: "#D97706" },
          { nome: "Sorgo", unidadeProducao: "sc", cicloDias: 110, cor: "#B45309" },
        ],
      },
    },
    include: { culturas: true },
  });

  const soja = tenant.culturas.find((c) => c.nome === "Soja")!;
  const milho = tenant.culturas.find((c) => c.nome === "Milho")!;
  const sorgo = tenant.culturas.find((c) => c.nome === "Sorgo")!;

  const produtor = await prisma.produtor.create({
    data: { tenantId: tenant.id, nome: "Matheus Henrique" },
  });

  const fazenda = await prisma.fazenda.create({
    data: {
      tenantId: tenant.id,
      produtorId: produtor.id,
      nome: "Fazenda Santa Clara",
      municipio: "Goiatuba",
      estado: "GO",
      areaTotal: 220,
      areaProdutiva: 184.3,
    },
  });

  const talhoesData = [
    { codigo: "T-01", area: 32.5, cultura: soja.id, status: "EM_PRODUCAO" },
    { codigo: "T-02", area: 28.7, cultura: soja.id, status: "EM_PRODUCAO" },
    { codigo: "T-03", area: 42.7, cultura: soja.id, status: "EM_MANEJO" },
    { codigo: "T-04", area: 30.0, cultura: milho.id, status: "EM_PRODUCAO" },
    { codigo: "T-05", area: 18.3, cultura: milho.id, status: "EM_PRODUCAO" },
    { codigo: "T-06", area: 15.6, cultura: sorgo.id, status: "DISPONIVEL" },
    { codigo: "T-07", area: 16.5, cultura: soja.id, status: "ATENCAO" },
  ] as const;

  const talhoes = [];
  for (const t of talhoesData) {
    talhoes.push(
      await prisma.talhao.create({
        data: {
          tenantId: tenant.id,
          fazendaId: fazenda.id,
          codigo: t.codigo,
          area: t.area,
          culturaAtualId: t.cultura,
          status: t.status,
        },
      }),
    );
  }

  // Safra 2026/2027 (Soja) com etapas e talhões de soja vinculados.
  const talhoesSoja = talhoes.filter((_, i) => ["T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-07"].includes(talhoesData[i].codigo));
  const safra = await prisma.safra.create({
    data: {
      tenantId: tenant.id,
      nome: "2026/2027",
      culturaId: soja.id,
      fazendaId: fazenda.id,
      status: "EM_ANDAMENTO",
      produtividadeEstimada: 59.9,
      precoVendaPrevisto: 120,
      etapas: {
        create: [
          { tenantId: tenant.id, etapa: "PLANEJAMENTO", ordem: 0, status: "CONCLUIDA" },
          { tenantId: tenant.id, etapa: "PLANTIO", ordem: 1, status: "CONCLUIDA" },
          { tenantId: tenant.id, etapa: "MANEJO", ordem: 2, status: "EM_ANDAMENTO" },
          { tenantId: tenant.id, etapa: "COLHEITA", ordem: 3, status: "PENDENTE" },
          { tenantId: tenant.id, etapa: "COMERCIALIZACAO", ordem: 4, status: "PENDENTE" },
        ],
      },
      talhoes: {
        create: talhoesSoja.map((t) => ({
          tenantId: tenant.id,
          talhaoId: t.id,
          areaPlantada: t.area,
        })),
      },
    },
  });

  await prisma.alerta.createMany({
    data: [
      { tenantId: tenant.id, tipo: "ESTOQUE", nivel: "CRITICO", titulo: "Fertilizante abaixo do necessário para o Talhão T-07", descricao: "Estoque baixo · hoje" },
      { tenantId: tenant.id, tipo: "OPERACAO", nivel: "ATENCAO", titulo: "Pulverização do Talhão T-03 prevista para amanhã", descricao: "Operação · amanhã 06:00" },
      { tenantId: tenant.id, tipo: "FINANCEIRO", nivel: "ATENCAO", titulo: "Parcela de R$ 18.400,00 vencendo em 3 dias", descricao: "Financeiro" },
      { tenantId: tenant.id, tipo: "MANUTENCAO", nivel: "INFO", titulo: "Manutenção do Trator 01 prevista em ~12 horas", descricao: "Máquinas · horímetro 1.238 h" },
    ],
  });

  console.log(`Demo criada: ${tenant.nome}`);
  console.log(`Login: ${DEMO_EMAIL} / demo123`);
  console.log(`Safra ${safra.nome} · ${talhoes.length} talhões`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
