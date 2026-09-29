import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { DIAS_CURTOS, diaSemanaDe, formatarHora, formatarYmd, hojeYmd, instante, minutosDoDia, partesYmd, somarDiasYmd, ymdDe } from "@/lib/tempo";
import { exigirSessao } from "@/modules/auth/guard";
import { incluirVM, paraVM } from "@/modules/painel/vm";
import { Cartao } from "@/components/ui";
import { AgendaDia } from "@/components/painel/agenda-dia";
import { BotaoNovoAgendamento } from "@/components/painel/novo-agendamento";
import { BotaoBloqueio } from "@/components/painel/bloqueio";
import { ListaAgendamentos } from "@/components/painel/lista-agendamentos";
import { SeletorData } from "@/components/painel/seletor-data";

export const metadata: Metadata = { title: "Agenda" };

export default async function PaginaAgenda(props: PageProps<"/painel/agenda">) {
  const { negocio } = await exigirSessao();
  const sp = await props.searchParams;
  const fuso = negocio.fusoHorario;
  const hoje = hojeYmd(fuso);
  const data = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : hoje;
  const soPendentes = sp.filtro === "pendentes";

  const ini = instante(data, 0, fuso);
  const fim = instante(somarDiasYmd(data, 1), 0, fuso);
  const inicioFaixa = somarDiasYmd(data, -3);
  const faixa = Array.from({ length: 7 }, (_, i) => somarDiasYmd(inicioFaixa, i));

  const [profissionais, agendamentos, bloqueios, servicos, daSemana, pendentes] = await Promise.all([
    prisma.profissional.findMany({
      where: { negocioId: negocio.id, ativo: true },
      include: { jornadas: true, servicos: { select: { id: true } } },
      orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
    }),
    prisma.agendamento.findMany({
      where: { negocioId: negocio.id, inicio: { gte: ini, lt: fim } },
      include: incluirVM,
      orderBy: { inicio: "asc" },
    }),
    prisma.bloqueio.findMany({
      where: { negocioId: negocio.id, inicio: { lt: fim }, fim: { gt: ini } },
      include: { profissional: { select: { nome: true } } },
    }),
    prisma.servico.findMany({ where: { negocioId: negocio.id, ativo: true }, orderBy: [{ ordem: "asc" }] }),
    prisma.agendamento.findMany({
      where: {
        negocioId: negocio.id,
        status: { in: ["PENDENTE", "CONFIRMADO", "CONCLUIDO"] },
        inicio: { gte: instante(faixa[0], 0, fuso), lt: instante(somarDiasYmd(faixa[6], 1), 0, fuso) },
      },
      select: { inicio: true },
    }),
    soPendentes
      ? prisma.agendamento.findMany({
          where: { negocioId: negocio.id, status: "PENDENTE", inicio: { gte: new Date() } },
          include: incluirVM,
          orderBy: { inicio: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const contagem = new Map<string, number>();
  for (const a of daSemana) {
    const d = ymdDe(a.inicio, fuso);
    contagem.set(d, (contagem.get(d) ?? 0) + 1);
  }

  const diaSemana = diaSemanaDe(data);
  const colunas = profissionais.map((p) => ({
    id: p.id,
    nome: p.nome,
    cor: p.cor,
    jornada: p.jornadas.filter((j) => j.diaSemana === diaSemana).map((j) => ({ inicio: j.inicioMin, fim: j.fimMin })),
  }));

  const ags = agendamentos.map((a) => paraVM(a, fuso));
  const minutosAgs = agendamentos.flatMap((a) => [minutosDoDia(a.inicio, fuso), minutosDoDia(a.fim, fuso) || 24 * 60]);
  const minutosJornada = colunas.flatMap((c) => c.jornada.flatMap((j) => [j.inicio, j.fim]));
  const todos = [...minutosAgs, ...minutosJornada];
  const deMin = Math.max(0, Math.floor(Math.min(8 * 60, ...todos) / 60) * 60);
  const ateMin = Math.min(24 * 60, Math.ceil(Math.max(19 * 60, ...todos) / 60) * 60);

  const opcoesNovo = {
    slug: negocio.slug,
    dataInicial: data >= hoje ? data : hoje,
    servicos: servicos.map((s) => ({ id: s.id, nome: s.nome, duracaoMin: s.duracaoMin, precoCentavos: s.precoCentavos })),
    profissionais: profissionais.map((p) => ({ id: p.id, nome: p.nome, servicos: p.servicos.map((s) => s.id) })),
  };

  const [, mes] = partesYmd(data);
  const validos = ags.filter((a) => a.status !== "CANCELADO");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {data === hoje ? "Hoje" : formatarYmd(data, "EEEE")}
            <span className="ml-2 font-medium normal-case text-suave">{formatarYmd(data, "d 'de' MMMM")}</span>
          </h1>
          <p className="text-sm text-suave">
            {validos.length} {validos.length === 1 ? "agendamento" : "agendamentos"}
            {bloqueios.length > 0 && ` · ${bloqueios.length} bloqueio(s)`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotaoBloqueio data={data} profissionais={profissionais.map((p) => ({ id: p.id, nome: p.nome }))} />
          <BotaoNovoAgendamento {...opcoesNovo} />
        </div>
      </div>

      {/* Navegação por dia */}
      <Cartao className="flex items-center gap-1 p-2">
        <Link href={`/painel/agenda?data=${somarDiasYmd(data, -1)}`} className="grid size-10 shrink-0 place-items-center rounded-xl hover:bg-fundo" aria-label="Dia anterior">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="sem-barra grid flex-1 grid-cols-7 gap-1 overflow-x-auto">
          {faixa.map((d) => {
            const [, m, dia] = partesYmd(d);
            const ativo = d === data;
            const n = contagem.get(d) ?? 0;
            return (
              <Link
                key={d}
                href={`/painel/agenda?data=${d}`}
                className={cn(
                  "relative flex min-w-11 flex-col items-center rounded-xl py-1.5 transition",
                  ativo ? "bg-ink text-white" : "hover:bg-fundo",
                )}
              >
                <span className={cn("text-[11px] font-semibold uppercase", ativo ? "text-white/60" : "text-suave")}>
                  {d === hoje ? "hoje" : DIAS_CURTOS[diaSemanaDe(d)]}
                </span>
                <span className="font-display text-lg font-bold leading-tight">
                  {dia}
                  {m !== mes && <span className="text-xs font-medium">/{m}</span>}
                </span>
                <span
                  className={cn(
                    "mt-0.5 h-1.5 rounded-full transition-all",
                    n === 0 ? "w-1.5 bg-transparent" : ativo ? "bg-marca-400" : "bg-marca-500",
                  )}
                  style={{ width: n ? Math.min(6 + n * 3, 28) : undefined }}
                />
              </Link>
            );
          })}
        </div>
        <Link href={`/painel/agenda?data=${somarDiasYmd(data, 1)}`} className="grid size-10 shrink-0 place-items-center rounded-xl hover:bg-fundo" aria-label="Próximo dia">
          <ChevronRight className="size-5" />
        </Link>
        <SeletorData valor={data} />
      </Cartao>

      {soPendentes && (
        <Cartao className="overflow-hidden border-alerta/30">
          <div className="flex items-center justify-between border-b border-linha bg-alerta-bg px-5 py-3">
            <h2 className="font-display font-bold text-ink">Aguardando sua confirmação</h2>
            <Link href={`/painel/agenda?data=${data}`} className="text-sm font-semibold text-suave hover:text-ink">
              Fechar
            </Link>
          </div>
          {pendentes.length === 0 ? (
            <p className="px-5 py-6 text-sm text-suave">Tudo confirmado! 🎉</p>
          ) : (
            <ListaAgendamentos itens={pendentes.map((a) => paraVM(a, fuso))} nomeNegocio={negocio.nome} mostrarData />
          )}
        </Cartao>
      )}

      <AgendaDia
        nomeNegocio={negocio.nome}
        colunas={colunas}
        agendamentos={ags}
        bloqueios={bloqueios.map((b) => ({
          id: b.id,
          profissionalId: b.profissionalId,
          inicioMin: b.inicio <= ini ? 0 : minutosDoDia(b.inicio, fuso),
          fimMin: b.fim >= fim ? 24 * 60 : minutosDoDia(b.fim, fuso),
          rotulo: `${b.motivo ?? "Bloqueado"}${b.inicio > ini || b.fim < fim ? ` · ${formatarHora(b.inicio, fuso)}–${formatarHora(b.fim, fuso)}` : ""}`,
        }))}
        inicioMin={deMin}
        fimMin={ateMin}
        minutosAgora={data === hoje ? minutosDoDia(new Date(), fuso) : null}
        minutosPorAg={Object.fromEntries(agendamentos.map((a) => [a.id, [minutosDoDia(a.inicio, fuso), minutosDoDia(a.fim, fuso) || 24 * 60]]))}
      />
    </div>
  );
}
