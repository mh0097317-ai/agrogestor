import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Download, MapPin, MessageCircle, Scissors, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatarHora, formatarNoFuso } from "@/lib/tempo";
import { formatarDuracao, formatarPreco, linkWhatsapp } from "@/lib/utils";
import { classesBotao, Logo, SeloStatus } from "@/components/ui";
import { CancelarAgendamento } from "@/components/publico/cancelar-agendamento";

export const metadata: Metadata = { title: "Seu agendamento", robots: { index: false } };

function linkGoogleAgenda(titulo: string, inicio: Date, fim: Date, local: string, detalhes: string) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const q = new URLSearchParams({ action: "TEMPLATE", text: titulo, dates: `${f(inicio)}/${f(fim)}`, location: local, details: detalhes });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export default async function PaginaAgendamento(props: PageProps<"/agendamento/[token]">) {
  const { token } = await props.params;
  const { novo } = await props.searchParams;
  const ag = await prisma.agendamento.findUnique({
    where: { token },
    include: { negocio: true, servico: true, profissional: true, cliente: true },
  });
  if (!ag) notFound();

  const n = ag.negocio;
  const fuso = n.fusoHorario;
  const ativo = ag.status === "CONFIRMADO" || ag.status === "PENDENTE";
  const futuro = ag.inicio.getTime() > Date.now();
  const recemCriado = novo === "1" && ativo;
  const local = [n.endereco, n.cidade].filter(Boolean).join(", ");

  const titulo =
    ag.status === "CANCELADO"
      ? "Agendamento cancelado"
      : ag.status === "PENDENTE"
        ? "Pedido enviado!"
        : ag.status === "CONCLUIDO"
          ? "Atendimento concluído"
          : recemCriado
            ? "Tudo certo, horário marcado!"
            : "Seu horário";

  const subtitulo =
    ag.status === "CANCELADO"
      ? "Esse horário foi liberado. Que tal marcar outro?"
      : ag.status === "PENDENTE"
        ? `A ${n.nome} vai confirmar seu horário e você recebe o aviso no WhatsApp.`
        : recemCriado
          ? "Enviamos a confirmação no seu WhatsApp. Te esperamos!"
          : `Olá, ${ag.cliente.nome.split(" ")[0]}! Aqui estão os detalhes.`;

  return (
    <div className="min-h-dvh pb-12" style={{ ["--marca" as string]: n.corPrimaria }}>
      <div className="relative overflow-hidden bg-ink pb-28 pt-6 text-white">
        <div className="grao absolute inset-0" />
        <div className="absolute -left-20 top-10 size-80 rounded-full opacity-40 blur-3xl" style={{ background: n.corPrimaria }} />
        <div className="relative mx-auto max-w-lg px-4 text-center">
          <Link href={`/${n.slug}`} className="text-sm font-semibold text-white/70 hover:text-white">
            {n.nome}
          </Link>
          <div
            className={`mx-auto mt-8 grid size-20 place-items-center rounded-full ${recemCriado ? "animate-pop" : ""}`}
            style={{ background: ag.status === "CANCELADO" ? "#ffffff22" : n.corPrimaria }}
          >
            {ag.status === "CANCELADO" ? (
              <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            )}
          </div>
          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">{titulo}</h1>
          <p className="mx-auto mt-2 max-w-sm text-white/70">{subtitulo}</p>
        </div>
      </div>

      <main className="relative mx-auto -mt-20 max-w-lg px-4">
        <div className="animate-surgir overflow-hidden rounded-3xl border border-linha bg-papel shadow-flutuante">
          <div className="flex items-center justify-between border-b border-dashed border-linha-forte px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-suave">
                {formatarNoFuso(ag.inicio, fuso, "EEEE")}
              </p>
              <p className="font-display text-2xl font-bold text-ink">
                {formatarNoFuso(ag.inicio, fuso, "d 'de' MMMM")}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-4xl font-extrabold tabular-nums text-ink">{formatarHora(ag.inicio, fuso)}</p>
              <p className="text-xs text-suave">até {formatarHora(ag.fim, fuso)}</p>
            </div>
          </div>

          <dl className="space-y-3.5 px-6 py-5 text-sm">
            <div className="flex items-center gap-3">
              <Scissors className="size-4 text-suave" />
              <dt className="sr-only">Serviço</dt>
              <dd className="flex-1 font-semibold text-ink">
                {ag.servico.nome} <span className="font-normal text-suave">· {formatarDuracao(ag.servico.duracaoMin)}</span>
              </dd>
              <dd className="font-display font-bold text-ink">{formatarPreco(ag.precoCentavos)}</dd>
            </div>
            <div className="flex items-center gap-3">
              <User className="size-4 text-suave" />
              <dt className="sr-only">Profissional</dt>
              <dd className="text-ink">com {ag.profissional.nome}</dd>
            </div>
            {local && (
              <div className="flex items-center gap-3">
                <MapPin className="size-4 text-suave" />
                <dt className="sr-only">Local</dt>
                <dd>
                  <a
                    className="text-ink underline decoration-linha-forte underline-offset-4 hover:decoration-ink"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(local)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {local}
                  </a>
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <SeloStatus status={ag.status} />
              <span className="text-xs text-suave">Nº {ag.id.slice(-6).toUpperCase()}</span>
            </div>
          </dl>

          {ativo && futuro && (
            <div className="grid grid-cols-2 gap-2 border-t border-linha bg-papel-2 px-6 py-4">
              <a
                href={linkGoogleAgenda(`${ag.servico.nome} — ${n.nome}`, ag.inicio, ag.fim, local, `Com ${ag.profissional.nome}`)}
                target="_blank"
                rel="noreferrer"
                className={classesBotao("secundario", "sm")}
              >
                <CalendarPlus className="size-4" /> Google Agenda
              </a>
              <a href={`/agendamento/${ag.token}/ics`} className={classesBotao("secundario", "sm")}>
                <Download className="size-4" /> iPhone / Outlook
              </a>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3">
          {n.whatsapp && (
            <a
              href={linkWhatsapp(
                n.whatsapp,
                `Olá! Sou ${ag.cliente.nome}, tenho horário de ${ag.servico.nome} ${formatarNoFuso(ag.inicio, fuso, "dd/MM 'às' HH:mm")}.`,
              )}
              target="_blank"
              rel="noreferrer"
              className={classesBotao("secundario", "lg", "w-full")}
            >
              <MessageCircle className="size-5 text-[#25D366]" /> Falar com {n.nome}
            </a>
          )}
          {ativo && futuro && <CancelarAgendamento token={ag.token} />}
          {(!ativo || !futuro) && (
            <Link href={`/${n.slug}`} className={classesBotao("primario", "lg", "w-full text-white")} style={{ background: n.corPrimaria }}>
              Agendar novo horário
            </Link>
          )}
        </div>

        <div className="mt-10 flex justify-center">
          <Link href="/" className="opacity-60 transition hover:opacity-100">
            <Logo className="scale-90" />
          </Link>
        </div>
      </main>
    </div>
  );
}
