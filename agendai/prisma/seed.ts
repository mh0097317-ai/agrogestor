/**
 * Dados de DEMONSTRAÇÃO. Cria 3 negócios fictícios com equipe, serviços, clientes e agenda.
 * Rodar: npm run db:seed   (apaga e recria só os negócios demo, identificados pelo slug)
 */
import { PrismaClient, type StatusAgendamento, type TipoNegocio } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SERVICOS_PADRAO, TIPOS_NEGOCIO } from "../src/lib/tipos-negocio";
import { hojeYmd, instante, somarDiasYmd, diaSemanaDe } from "../src/lib/tempo";

const prisma = new PrismaClient();
const FUSO = "America/Sao_Paulo";

type Demo = {
  slug: string;
  nome: string;
  tipo: TipoNegocio;
  descricao: string;
  endereco: string;
  cidade: string;
  instagram: string;
  whatsapp: string;
  dono: { nome: string; email: string };
  equipe: { nome: string; bio: string; cor: string }[];
  dias: number[];
  abre: number;
  fecha: number;
  almoco?: [number, number];
};

const DEMOS: Demo[] = [
  {
    slug: "dom-bigode",
    nome: "Dom Bigode",
    tipo: "BARBEARIA",
    descricao: "Barbearia clássica com toalha quente, navalha e aquela cerveja gelada por conta da casa. 🍺",
    endereco: "Rua Aspicuelta, 312",
    cidade: "São Paulo - SP",
    instagram: "dombigode",
    whatsapp: "5511987654321",
    dono: { nome: "Leonardo Bigode", email: "demo@agendai.app" },
    equipe: [
      { nome: "Léo", bio: "Dono · especialista em degradê e barba desenhada", cor: "#C8872E" },
      { nome: "Rafa", bio: "Cortes clássicos e navalhado", cor: "#2F6FDE" },
      { nome: "Thiago", bio: "Freestyle, pigmentação e platinado", cor: "#16A085" },
    ],
    dias: [2, 3, 4, 5, 6],
    abre: 9 * 60,
    fecha: 20 * 60,
  },
  {
    slug: "studio-bella",
    nome: "Studio Bella",
    tipo: "SALAO_FEMININO",
    descricao: "Cabelo, unhas e sobrancelhas num espaço aconchegante. Café e prosa boa inclusos ☕",
    endereco: "Av. Getúlio Vargas, 1450 - Savassi",
    cidade: "Belo Horizonte - MG",
    instagram: "studiobella.bh",
    whatsapp: "5531991234567",
    dono: { nome: "Isabela Martins", email: "bella@agendai.app" },
    equipe: [
      { nome: "Bella", bio: "Coloração e mechas", cor: "#D94680" },
      { nome: "Carol", bio: "Cortes e escovas", cor: "#7B5CE0" },
      { nome: "Jéssica", bio: "Manicure, pedicure e design de sobrancelha", cor: "#E4572E" },
    ],
    dias: [1, 2, 3, 4, 5, 6],
    abre: 9 * 60,
    fecha: 19 * 60,
    almoco: [12 * 60, 13 * 60],
  },
  {
    slug: "corte-fino",
    nome: "Corte Fino",
    tipo: "SALAO_MASCULINO",
    descricao: "Corte rápido, bem feito e sem enrolação. Atendemos a família toda.",
    endereco: "Rua XV de Novembro, 88",
    cidade: "Curitiba - PR",
    instagram: "cortefino.cwb",
    whatsapp: "5541998765432",
    dono: { nome: "Marcos Andrade", email: "cortefino@agendai.app" },
    equipe: [
      { nome: "Marcos", bio: "Cortes sociais e infantis", cor: "#2F6FDE" },
      { nome: "Diego", bio: "Luzes e platinado", cor: "#0F766E" },
    ],
    dias: [1, 2, 3, 4, 5, 6],
    abre: 8 * 60,
    fecha: 18 * 60,
  },
];

const NOMES = [
  "Rafael Souza", "Bruno Lima", "Gustavo Rocha", "Felipe Alves", "Lucas Martins", "Pedro Henrique", "João Vitor",
  "Matheus Costa", "Carlos Eduardo", "André Luiz", "Vinícius Ramos", "Diego Ferreira", "Ana Paula", "Mariana Silva",
  "Juliana Santos", "Camila Oliveira", "Fernanda Lopes", "Beatriz Nunes", "Larissa Gomes", "Patrícia Reis",
  "Gabriela Dias", "Amanda Freitas", "Letícia Moura", "Renata Carvalho",
];

function aleatorio<T>(lista: T[], semente: number): T {
  return lista[Math.abs(Math.floor(Math.sin(semente) * 10000)) % lista.length];
}

async function criarDemo(d: Demo, idx: number) {
  await prisma.negocio.deleteMany({ where: { slug: d.slug } });
  await prisma.usuario.deleteMany({ where: { email: d.dono.email } });

  const faixas = d.dias.flatMap((dia) =>
    d.almoco
      ? [
          { diaSemana: dia, inicioMin: d.abre, fimMin: d.almoco[0] },
          { diaSemana: dia, inicioMin: d.almoco[1], fimMin: d.fecha },
        ]
      : [{ diaSemana: dia, inicioMin: d.abre, fimMin: d.fecha }],
  );

  const negocio = await prisma.negocio.create({
    data: {
      slug: d.slug,
      nome: d.nome,
      tipo: d.tipo,
      descricao: d.descricao,
      endereco: d.endereco,
      cidade: d.cidade,
      instagram: d.instagram,
      whatsapp: d.whatsapp,
      email: d.dono.email,
      corPrimaria: TIPOS_NEGOCIO[d.tipo].cor,
      horarios: { create: faixas },
    },
  });

  await prisma.usuario.create({
    data: { negocioId: negocio.id, nome: d.dono.nome, email: d.dono.email, senhaHash: await bcrypt.hash("demo123", 10) },
  });

  const servicos = await Promise.all(
    SERVICOS_PADRAO[d.tipo].map((s, ordem) =>
      prisma.servico.create({
        data: { negocioId: negocio.id, nome: s.nome, descricao: s.descricao, duracaoMin: s.duracaoMin, precoCentavos: s.preco * 100, ordem },
      }),
    ),
  );

  const pros = await Promise.all(
    d.equipe.map((p, ordem) =>
      prisma.profissional.create({
        data: {
          negocioId: negocio.id,
          nome: p.nome,
          bio: p.bio,
          cor: p.cor,
          ordem,
          servicos: { connect: servicos.map((s) => ({ id: s.id })) },
          jornadas: { create: faixas },
        },
      }),
    ),
  );

  const clientes = await Promise.all(
    NOMES.slice(idx * 4, idx * 4 + 16).map((nome, i) =>
      prisma.cliente.create({
        data: { negocioId: negocio.id, nome, telefone: `55119${String(80000000 + i * 137 + idx * 9001).padStart(8, "0")}` },
      }),
    ),
  );

  // Agenda: de 10 dias atrás até 7 dias à frente, encaixando atendimentos sem sobreposição.
  const hoje = hojeYmd(FUSO);
  const agora = Date.now();
  let semente = idx * 1000 + 7;
  let criados = 0;

  for (let delta = -10; delta <= 7; delta++) {
    const dia = somarDiasYmd(hoje, delta);
    if (!d.dias.includes(diaSemanaDe(dia))) continue;
    for (const pro of pros) {
      let cursor = d.abre;
      while (cursor < d.fecha - 30) {
        semente++;
        const pular = Math.abs(Math.sin(semente * 3.1)) < (delta > 0 ? 0.55 : 0.3);
        const servico = aleatorio(servicos, semente);
        if (d.almoco && cursor < d.almoco[1] && cursor + servico.duracaoMin > d.almoco[0]) {
          cursor = d.almoco[1];
          continue;
        }
        if (pular || cursor + servico.duracaoMin > d.fecha) {
          cursor += 30;
          continue;
        }
        const inicio = instante(dia, cursor, FUSO);
        const fim = new Date(inicio.getTime() + servico.duracaoMin * 60_000);
        const passado = fim.getTime() < agora;
        const r = Math.abs(Math.sin(semente * 7.7));
        let status: StatusAgendamento = passado ? "CONCLUIDO" : "CONFIRMADO";
        if (passado && r < 0.08) status = "NAO_COMPARECEU";
        else if (r > 0.94) status = "CANCELADO";
        else if (!passado && delta > 0 && r < 0.12) status = "PENDENTE";

        const cliente = aleatorio(clientes, semente * 13);
        await prisma.agendamento.create({
          data: {
            negocioId: negocio.id,
            clienteId: cliente.id,
            profissionalId: pro.id,
            servicoId: servico.id,
            inicio,
            fim,
            status,
            origem: r > 0.3 ? "ONLINE" : "PAINEL",
            precoCentavos: servico.precoCentavos,
            createdAt: new Date(inicio.getTime() - (2 + (semente % 5)) * 86_400_000),
            lembreteEnviadoEm: passado ? inicio : null,
            ...(status === "CANCELADO" ? { canceladoEm: new Date(), motivoCancelamento: "Imprevisto no trabalho" } : {}),
          },
        });
        criados++;
        cursor += servico.duracaoMin + (r > 0.6 ? 15 : 0);
      }
    }
  }

  // Alguns avisos recentes no painel.
  const recentes = await prisma.agendamento.findMany({
    where: { negocioId: negocio.id, inicio: { gte: new Date() }, origem: "ONLINE" },
    include: { cliente: true, servico: true },
    orderBy: { createdAt: "desc" },
    take: 4,
  });
  for (const [i, a] of recentes.entries()) {
    await prisma.notificacao.create({
      data: {
        negocioId: negocio.id,
        agendamentoId: a.id,
        destinatario: "DONO",
        canal: "PAINEL",
        tipo: "NOVO_AGENDAMENTO",
        titulo: `Novo agendamento: ${a.cliente.nome} — ${a.servico.nome}`,
        mensagem: "",
        status: "ENVIADA",
        lida: i > 1,
        createdAt: new Date(Date.now() - (i + 1) * 47 * 60_000),
      },
    });
  }

  console.log(`✔ ${d.nome.padEnd(14)} /${d.slug.padEnd(12)} ${criados} agendamentos · login ${d.dono.email} / demo123`);
}

async function main() {
  console.log("Criando dados de demonstração...\n");
  for (const [i, d] of DEMOS.entries()) await criarDemo(d, i);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
