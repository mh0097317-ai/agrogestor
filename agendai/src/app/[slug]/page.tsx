import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AtSign, Clock, MapPin, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { TIPOS_NEGOCIO } from "@/lib/tipos-negocio";
import { DIAS_CURTOS, diaSemanaDe, hojeYmd, minParaHora, minutosDoDia } from "@/lib/tempo";
import { cn, linkWhatsapp } from "@/lib/utils";
import { Logo } from "@/components/ui";
import { FluxoAgendamento } from "@/components/publico/fluxo-agendamento";
import { diasComExpediente } from "@/modules/agenda/disponibilidade";

async function carregar(slug: string) {
  return prisma.negocio.findUnique({
    where: { slug },
    include: {
      horarios: { orderBy: [{ diaSemana: "asc" }, { inicioMin: "asc" }] },
      servicos: { where: { ativo: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] },
      profissionais: {
        where: { ativo: true },
        orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
        include: { servicos: { select: { id: true } } },
      },
    },
  });
}

export async function generateMetadata(props: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const n = await prisma.negocio.findUnique({ where: { slug }, select: { nome: true, tipo: true, cidade: true } });
  if (!n) return { title: "Não encontrado" };
  return {
    title: `Agende em ${n.nome}`,
    description: `Marque seu horário na ${n.nome}${n.cidade ? ` em ${n.cidade}` : ""} em segundos. ${TIPOS_NEGOCIO[n.tipo].rotulo}.`,
  };
}

export default async function PaginaNegocio(props: PageProps<"/[slug]">) {
  await connection();
  const { slug } = await props.params;
  const negocio = await carregar(slug);
  if (!negocio || !negocio.ativo) notFound();

  const tipo = TIPOS_NEGOCIO[negocio.tipo];
  const fuso = negocio.fusoHorario;
  const hoje = hojeYmd(fuso);
  const agoraMin = minutosDoDia(new Date(), fuso);
  const hojeHorarios = negocio.horarios.filter((h) => h.diaSemana === diaSemanaDe(hoje));
  const abertoAgora = hojeHorarios.some((h) => agoraMin >= h.inicioMin && agoraMin < h.fimMin);
  const diasAbertos = await diasComExpediente(negocio);

  const gradeHorarios = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    dia: d,
    faixas: negocio.horarios.filter((h) => h.diaSemana === d),
  }));

  return (
    <div className="min-h-dvh" style={{ ["--marca" as string]: negocio.corPrimaria }}>
      {/* Hero */}
      <header className="relative overflow-hidden bg-ink text-white">
        <div className="grao absolute inset-0" />
        <div
          className="absolute -right-24 -top-24 size-96 rounded-full opacity-40 blur-3xl"
          style={{ background: negocio.corPrimaria }}
        />
        {negocio.tipo === "BARBEARIA" && <div className="listras absolute inset-0 opacity-60" />}
        <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:pb-28">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              {tipo.emoji} {tipo.rotulo}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur",
                abertoAgora ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/70",
              )}
            >
              <span className={cn("size-1.5 rounded-full", abertoAgora ? "bg-emerald-400 animate-pulse" : "bg-white/50")} />
              {abertoAgora ? "Aberto agora" : "Fechado agora"}
            </span>
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
            <div
              className="grid size-16 shrink-0 place-items-center rounded-2xl font-display text-2xl font-extrabold shadow-lg sm:size-20 sm:text-3xl"
              style={{ background: negocio.corPrimaria }}
            >
              {negocio.nome.trim()[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{negocio.nome}</h1>
              {negocio.descricao && <p className="mt-2 max-w-xl text-sm text-white/70 sm:text-base">{negocio.descricao}</p>}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            {negocio.endereco && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${negocio.endereco} ${negocio.cidade ?? ""}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/85 hover:bg-white/15"
              >
                <MapPin className="size-4" /> {negocio.endereco}
                {negocio.cidade ? ` · ${negocio.cidade}` : ""}
              </a>
            )}
            {negocio.whatsapp && (
              <a
                href={linkWhatsapp(negocio.whatsapp, `Olá, ${negocio.nome}!`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/85 hover:bg-white/15"
              >
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            )}
            {negocio.instagram && (
              <a
                href={`https://instagram.com/${negocio.instagram.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/85 hover:bg-white/15"
              >
                <AtSign className="size-4" /> @{negocio.instagram.replace(/^@/, "")}
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto -mt-16 grid max-w-5xl gap-5 px-4 pb-16 sm:-mt-20 sm:px-6 lg:grid-cols-[1fr_300px]">
        <FluxoAgendamento
          slug={negocio.slug}
          nomeNegocio={negocio.nome}
          fuso={fuso}
          hoje={hoje}
          janelaDias={negocio.janelaDias}
          diasAbertos={diasAbertos}
          confirmacaoAutomatica={negocio.confirmacaoAutomatica}
          servicos={negocio.servicos.map((s) => ({
            id: s.id,
            nome: s.nome,
            descricao: s.descricao,
            duracaoMin: s.duracaoMin,
            precoCentavos: s.precoCentavos,
          }))}
          profissionais={negocio.profissionais.map((p) => ({
            id: p.id,
            nome: p.nome,
            bio: p.bio,
            cor: p.cor,
            servicos: p.servicos.map((s) => s.id),
          }))}
        />

        <aside className="space-y-5 lg:pt-0">
          <div className="rounded-2xl border border-linha bg-papel p-5 shadow-cartao">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
              <Clock className="size-4 text-suave" /> Horário de funcionamento
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {gradeHorarios.map(({ dia, faixas }) => {
                const ehHoje = dia === diaSemanaDe(hoje);
                return (
                  <li key={dia} className={cn("flex justify-between gap-3", ehHoje ? "font-semibold text-ink" : "text-suave")}>
                    <span>
                      {DIAS_CURTOS[dia]}
                      {ehHoje && <span className="ml-1.5 text-xs text-[color:var(--marca)]">hoje</span>}
                    </span>
                    <span className="tabular-nums">
                      {faixas.length === 0
                        ? "Fechado"
                        : faixas.map((f) => `${minParaHora(f.inicioMin)}–${minParaHora(f.fimMin)}`).join(" · ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <Link href="/" className="flex items-center justify-center gap-2 text-xs text-suave hover:text-ink">
            Agenda online por <Logo className="scale-75 origin-left" />
          </Link>
        </aside>
      </main>
    </div>
  );
}
