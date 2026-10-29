import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { WeeklyReport } from "@/lib/weekly-report";

const cash = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value / 100,
  );
const date = (value: string) => value.split("-").reverse().join("/");
export async function weeklyReportPdf(
  report: WeeklyReport & {
    platform?: boolean;
    daily?: boolean;
    newBusinesses?: number;
    overdueCents?: number;
  },
) {
  const doc = await PDFDocument.create();
  doc.setTitle(
    `StudioFlow - Relatório ${report.daily ? "diário" : "semanal"} - ${report.from}`,
  );
  doc.setAuthor("StudioFlow");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const ink = rgb(0.16, 0.17, 0.18),
    muted = rgb(0.42, 0.43, 0.43),
    green = rgb(0.2, 0.21, 0.22),
    gold = rgb(0.68, 0.46, 0.26),
    cream = rgb(0.97, 0.96, 0.93);
  let page = doc.addPage([595.28, 841.89]);
  const safe = (value: string, font: PDFFont) =>
    [...value.replace(/[\r\n\t]/g, " ")]
      .map((c) => {
        try {
          font.encodeText(c);
          return c;
        } catch {
          return "?";
        }
      })
      .join("");
  const text = (
    value: string,
    x: number,
    y: number,
    size = 10,
    font = regular,
    color = ink,
    width = 510,
  ) => {
    let s = safe(value, font);
    while (font.widthOfTextAtSize(s, size) > width && s.length)
      s = s.slice(0, -1);
    page.drawText(s, { x, y, size, font, color });
  };
  const frame = (subtitle: string) => {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 595.28,
      height: 841.89,
      color: cream,
    });
    page.drawRectangle({ x: 40, y: 784, width: 34, height: 3, color: gold });
    text("STUDIOFLOW", 84, 780, 10, bold, green);
    text(subtitle, 40, 737, 29, serif);
    text(report.businessName, 40, 706, 12, bold);
    text(
      report.daily
        ? `${date(report.from)} | Fechamento do dia`
        : `${date(report.from)} a ${date(report.to)} | Segunda a domingo`,
      40,
      686,
      10,
      regular,
      muted,
    );
    text(
      report.demo
        ? "DEMONSTRAÇÃO - DADOS FICTÍCIOS"
        : report.platform
          ? "DONO DA PLATAFORMA | CONFIDENCIAL"
          : report.audience === "owner"
            ? "VISÃO DO DONO | USO INTERNO"
            : `PROFISSIONAL | ${report.professionalName}`,
      40,
      663,
      9,
      bold,
      gold,
    );
  };
  frame(
    report.daily ? "Seu dia, em perspectiva." : "Sua semana, em perspectiva.",
  );
  const metrics = [
    ["RECEBIDO", cash(report.totalReceived)],
    [
      report.platform ? "MENSALIDADES PAGAS" : "CONCLUÍDOS",
      String(report.completed),
    ],
    [
      report.platform ? "LOJAS ATIVAS HOJE" : "CLIENTES ATENDIDOS",
      String(report.customers),
    ],
  ];
  metrics.forEach(([label, value], i) => {
    const x = 40 + i * 175;
    page.drawRectangle({
      x,
      y: 551,
      width: 165,
      height: 81,
      color: i === 0 ? green : rgb(0.91, 0.92, 0.88),
    });
    text(label, x + 13, 608, 8, bold, i === 0 ? cream : muted, 138);
    text(value, x + 13, 574, 21, serif, i === 0 ? cream : ink, 138);
  });
  text(
    report.platform ? "Ritmo dos recebimentos" : "Ritmo dos atendimentos",
    40,
    505,
    21,
    serif,
  );
  text(
    report.platform
      ? "Mensalidades pagas em cada dia da semana"
      : "Atendimentos concluídos no período",
    40,
    486,
    10,
    regular,
    muted,
  );
  const max = Math.max(1, ...report.days.map((d) => d.completed));
  report.days.forEach((d, i) => {
    const step = 511 / report.days.length,
      x = 49 + i * step + (step - 41) / 2,
      h = (d.completed / max) * 110;
    page.drawRectangle({
      x,
      y: 331,
      width: 41,
      height: Math.max(1, h),
      color: green,
    });
    text(String(d.completed), x + 14, 342 + h, 10, bold);
    text(
      ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"][
        new Date(`${d.date}T12:00:00Z`).getUTCDay()
      ],
      x,
      310,
      8,
      bold,
      muted,
    );
    text(d.date.slice(8) + "/" + d.date.slice(5, 7), x, 295, 8, regular, muted);
  });
  text("Pontos de atenção", 40, 251, 21, serif);
  text(
    report.platform
      ? `Em atraso hoje: ${cash(report.overdueCents || 0)} | Lojas pausadas: ${report.cancelled} | Novas na semana: ${report.newBusinesses || 0}`
      : `Faltas: ${report.missed}   |   Cancelamentos: ${report.cancelled}   |   Comparecimento: ${report.attendance === null ? "sem dados" : report.attendance + "%"}`,
    40,
    225,
    11,
  );
  text(
    report.platform
      ? "Consulte as pendências atuais no financeiro da plataforma antes de cobrar."
      : report.missed
        ? "Revise as faltas e acompanhe as confirmações antes do próximo atendimento."
        : report.completed
          ? "Sem faltas registradas no período. Continue acompanhando os lembretes."
          : "Ainda não há atendimentos concluídos registrados para este período.",
    40,
    201,
    10,
    regular,
    muted,
  );
  text("O que este número representa", 40, 153, 12, bold);
  text(
    "Recebido usa a data do pagamento. Agendamento previsto não é receita recebida.",
    40,
    133,
    9,
    regular,
    muted,
  );
  text(
    report.platform
      ? "Mensalidades da StudioFlow; não soma o faturamento dos clientes da plataforma."
      : report.audience === "owner"
        ? `Serviços: ${cash(report.received)} | Produtos pagos: ${cash(report.productReceived)}`
        : "Somente atendimentos e recebimentos vinculados a este profissional.",
    40,
    115,
    9,
    regular,
    muted,
  );
  page = doc.addPage([595.28, 841.89]);
  frame("Os detalhes que fazem diferença.");
  let y = 619;
  const section = (label: string) => {
    if (y < 155) {
      page = doc.addPage([595.28, 841.89]);
      frame("Detalhes do período.");
      y = 615;
    }
    text(label, 40, y, 19, serif);
    y -= 32;
  };
  const row = (name: string, values: string) => {
    if (y < 105) {
      page = doc.addPage([595.28, 841.89]);
      frame("Detalhes do período.");
      y = 615;
    }
    page.drawLine({
      start: { x: 40, y: y - 9 },
      end: { x: 555, y: y - 9 },
      color: rgb(0.81, 0.84, 0.79),
      thickness: 0.5,
    });
    text(name, 40, y, 10, bold, ink, 220);
    text(values, 275, y, 9, regular, muted, 275);
    y -= 32;
  };
  section(
    report.platform
      ? "Recebido por estabelecimento"
      : report.audience === "owner"
        ? "Resultado por profissional"
        : "Seu resultado",
  );
  report.professionals.forEach((p) =>
    row(
      p.name,
      report.platform
        ? `${p.completed} mensalidades pagas | ${cash(p.received)}`
        : `${p.completed} concluídos | ${cash(p.received)} | Comissão ${cash(p.commission)}`,
    ),
  );
  y -= 10;
  section(
    report.platform
      ? "Situação atual dos estabelecimentos"
      : "Serviços mais realizados",
  );
  if (!report.services.length)
    row("Sem atendimentos concluídos", "Nenhum serviço registrado no período");
  report.services.forEach((s) =>
    row(
      s.name,
      `${s.count} ${report.platform ? "estabelecimentos hoje" : "atendimentos concluídos"}`,
    ),
  );
  y -= 12;
  section("Critérios do relatório");
  (report.platform
    ? [
        "Período e datas no fuso America/Sao_Paulo.",
        "Recebimentos usam a data do pagamento das mensalidades cadastradas.",
        "Ativas, pausadas e atrasos são o estado atual, não um histórico reconstruído.",
        "Não inclui receita dos estabelecimentos, custos ou lucro da plataforma.",
      ]
    : [
        "Período e datas no fuso America/Sao_Paulo.",
        "Comparecimento: concluídos / (concluídos + faltas).",
        "Comissão estimada sobre recebimentos, usando a taxa atual do profissional.",
        "Não representa comissão liquidada, lucro, entrega ou leitura de mensagens.",
        "Não inclui assinaturas do clube, despesas ou recebimentos fora dos registros consultados.",
      ]
  ).forEach((line) => {
    if (y < 105) {
      page = doc.addPage([595.28, 841.89]);
      frame("Critérios do período.");
      y = 615;
    }
    text(line, 40, y, 9, regular, muted, 510);
    y -= 22;
  });
  doc.getPages().forEach((p, i) => {
    page = p;
    page.drawLine({
      start: { x: 40, y: 58 },
      end: { x: 555, y: 58 },
      color: rgb(0.81, 0.84, 0.79),
      thickness: 0.5,
    });
    text(
      `StudioFlow | Relatório ${report.daily ? "diário" : "semanal"}${report.demo ? " | Demonstração" : ""}`,
      40,
      40,
      8,
      regular,
      muted,
    );
    text(`${i + 1} / ${doc.getPageCount()}`, 515, 40, 8, regular, muted, 40);
  });
  return doc.save();
}
