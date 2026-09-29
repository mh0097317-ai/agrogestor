import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/utils";

function dataIcs(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string) {
  return s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
}

export async function GET(_: Request, ctx: RouteContext<"/agendamento/[token]/ics">) {
  const { token } = await ctx.params;
  const ag = await prisma.agendamento.findUnique({
    where: { token },
    include: { negocio: true, servico: true, profissional: true },
  });
  if (!ag) return new Response("Não encontrado", { status: 404 });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Agendai//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ag.id}@agendai`,
    `DTSTAMP:${dataIcs(new Date())}`,
    `DTSTART:${dataIcs(ag.inicio)}`,
    `DTEND:${dataIcs(ag.fim)}`,
    `SUMMARY:${esc(`${ag.servico.nome} — ${ag.negocio.nome}`)}`,
    `DESCRIPTION:${esc(`Com ${ag.profissional.nome}. Detalhes: ${appUrl()}/agendamento/${ag.token}`)}`,
    ag.negocio.endereco ? `LOCATION:${esc(`${ag.negocio.endereco}${ag.negocio.cidade ? `, ${ag.negocio.cidade}` : ""}`)}` : "",
    ag.status === "CANCELADO" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(ag.servico.nome)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="agendamento.ics"`,
    },
  });
}
