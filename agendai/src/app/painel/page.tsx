import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, CalendarClock, CalendarDays, MessageCircle, Sparkles, TrendingUp, UserPlus, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { appUrl, cn, formatarPreco, linkWhatsapp } from "@/lib/utils";
import { formatarNoFuso, hojeYmd, instante, minutosDoDia, somarDiasYmd, formatarYmd } from "@/lib/tempo";
import { exigirSessao } from "@/modules/auth/guard";
import { incluirVM, paraVM } from "@/modules/painel/vm";
import { Cartao, Vazio } from "@/components/ui";
import { CopiarLink } from "@/components/painel/copiar-link";
import { ListaAgendamentos } from "@/components/painel/lista-agendamentos";
import { BotaoNovoAgendamento } from "@/components/painel/novo-agendamento";
import { LinksExtrasMobile } from "@/components/painel/navegacao";

export const metadata: Metadata = { title: "Painel" };

function saudacao(minutos: number) {
  if (minutos < 12 * 60) return "Bom dia";
  if (minutos < 18 * 60) return "Boa tarde";
  return "Boa noite";
}

export default async function PainelInicio(props: PageProps<"/painel">) {
  const { sessao, negocio } = await exigirSessao();
  const { boasvindas } = await props.searchParams;
  const fuso = negocio.fusoHorario;
  const hoje = hojeYmd(fuso);
  const iniHoje = instante(hoje, 0, fuso);
  const fimHoje = instante(somarDiasYmd(hoje, 1), 0, fuso);
  const fimSemana = instante(somarDiasYmd(hoje, 7), 0, fuso);
  const agora = new Date();

  const [doDia, proximos, semana, novosClientes, avisos, servicos, profissionais, pendentes] = await Promise.all([
    prisma.agendamento.findMany({
      where: { negocioId: negocio.id, inicio: { gte: iniHoje, lt: fimHoje } },
      include: incluirVM,
      orderBy: { inicio: "asc" },
    }),
    prisma.agendamento.findMany({
      where: { negocioId: negocio.id, inicio: { gte: fimHoje }, status: { in: ["PENDENTE", "CONFIRMADO"] } },
      include: incluirVM,
      orderBy: { inicio: "asc" },
      take: 6,
    }),
    prisma.agendamento.count({
      where: { negocioId: negocio.id, inicio: { gte: agora, lt: fimSemana }, status: { in: ["PENDENTE", "CONFIRMADO"] } },
    }),
    prisma.cliente.count({ where: { negocioId: negocio.id, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
    prisma.notificacao.findMany({
      where: { negocioId: negocio.id, canal: "PAINEL" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.servico.findMany({ where: { negocioId: negocio.id, ativo: true }, orderBy: [{ ordem: "asc" }] }),
    prisma.profissional.findMany({ where: { negocioId: negocio.id, ativo: true }, include: { servicos: { select: { id: true } } }, orderBy: [{ ordem: "asc" }] }),
    prisma.agendamento.count({ where: { negocioId: negocio.id, status: "PENDENTE", inicio: { gte: agora } } }),
  ]);

  const validosHoje = doDia.filter((a) => a.status !== "CANCELADO" && a.status !== "NAO_COMPARECEU");
  const faturamentoHoje = validosHoje.reduce((s, a) => s + a.precoCentavos, 0);
  const restantesHoje = validosHoje.filter((a) => a.fim > agora && a.status !== "CONCLUIDO").length;
  const link = `${appUrl()}/${negocio.slug}`;
  const primeiroNome = sessao.nome.split(" ")[0];

  const kpis = [
    { rotulo: "Hoje", valor: String(validosHoje.length), extra: restantesHoje ? `${restantesHoje} ainda por vir` : "agenda do dia", icone: CalendarDays },
    { rotulo: "Previsto hoje", valor: formatarPreco(faturamentoHoje), extra: "em serviços", icone: Wallet },
    { rotulo: "Próximos 7 dias", valor: String(semana), extra: "agendamentos", icone: TrendingUp },
    { rotulo: "Clientes novos", valor: String(novosClientes), extra: "últimos 30 dias", icone: UserPlus },
  ];

  const opcoesNovo = {
    slug: negocio.slug,
    dataInicial: hoje,
    servicos: servicos.map((s) => ({ id: s.id, nome: s.nome, duracaoMin: s.duracaoMin, precoCentavos: s.precoCentavos })),
    profissionais: profissionais.map((p) => ({ id: p.id, nome: p.nome, servicos: p.servicos.map((s) => s.id) })),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-suave">{formatarYmd(hoje, "EEEE, d 'de' MMMM")}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            {saudacao(minutosDoDia(agora, fuso))}, {primeiroNome}!
          </h1>
        </div>
        <BotaoNovoAgendamento {...opcoesNovo} />
      </div>

      <LinksExtrasMobile />

      {boasvindas === "1" && (
        <Cartao className="relative animate-surgir overflow-hidden border-0 bg-ink p-6 text-white">
          <div className="grao absolute inset-0" />
          <div className="absolute -right-10 -top-10 size-56 rounded-full bg-marca-500/50 blur-3xl" />
          <div className="relative">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
              <Sparkles className="size-3.5" /> Sua agenda está no ar!
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold">Agora é só divulgar seu link 🚀</h2>
            <p className="mt-1 max-w-xl text-white/70">
              Coloque na bio do Instagram, no status do WhatsApp e mande para seus clientes. Já deixamos serviços, preços e horários sugeridos — revise em{" "}
              <Link href="/painel/servicos" className="underline">Serviços</Link> e <Link href="/painel/configuracoes" className="underline">Configurações</Link>.
            </p>
          </div>
        </Cartao>
      )}

      {/* Link de agendamento */}
      <Cartao className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-marca-50 text-marca-500">
          <CalendarClock className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Seu link de agendamento</p>
          <p className="truncate font-mono text-sm text-suave">{link.replace(/^https?:\/\//, "")}</p>
        </div>
        <div className="flex gap-2">
          <CopiarLink url={link} className="h-10 rounded-xl bg-ink px-4 text-sm text-white hover:bg-ink-2" />
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Agora você pode marcar seu horário na ${negocio.nome} pelo link: ${link}`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-linha-forte px-3 text-sm font-semibold text-ink hover:bg-fundo"
          >
            <MessageCircle className="size-4 text-[#25D366]" /> Divulgar
          </a>
        </div>
      </Cartao>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Cartao key={k.rotulo} className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-suave">{k.rotulo}</p>
              <k.icone className="size-4 text-apagado" />
            </div>
            <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{k.valor}</p>
            <p className="text-xs text-suave">{k.extra}</p>
          </Cartao>
        ))}
      </div>

      {pendentes > 0 && (
        <Link href="/painel/agenda?filtro=pendentes" className="flex items-center gap-3 rounded-2xl border border-alerta/30 bg-alerta-bg px-5 py-4 text-sm font-semibold text-ink">
          <span className="grid size-8 place-items-center rounded-full bg-alerta text-white">{pendentes}</span>
          {pendentes === 1 ? "agendamento aguardando" : "agendamentos aguardando"} sua confirmação
          <ArrowRight className="ml-auto size-4" />
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Cartao className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-linha px-5 py-4">
              <h2 className="font-display text-lg font-bold text-ink">Agenda de hoje</h2>
              <Link href="/painel/agenda" className="text-sm font-semibold text-marca-600 hover:underline">
                Ver agenda completa
              </Link>
            </div>
            {doDia.length === 0 ? (
              <Vazio icone={<CalendarDays className="size-6" />} titulo="Nenhum horário hoje" texto="Divulgue seu link para os clientes começarem a agendar." />
            ) : (
              <ListaAgendamentos itens={doDia.map((a) => paraVM(a, fuso))} nomeNegocio={negocio.nome} />
            )}
          </Cartao>

          {proximos.length > 0 && (
            <Cartao className="overflow-hidden">
              <div className="border-b border-linha px-5 py-4">
                <h2 className="font-display text-lg font-bold text-ink">Próximos dias</h2>
              </div>
              <ListaAgendamentos itens={proximos.map((a) => paraVM(a, fuso))} nomeNegocio={negocio.nome} mostrarData />
            </Cartao>
          )}
        </div>

        <Cartao className="h-fit overflow-hidden">
          <div className="flex items-center justify-between border-b border-linha px-5 py-4">
            <h2 className="font-display text-lg font-bold text-ink">Últimos avisos</h2>
            <Link href="/painel/avisos" className="text-sm font-semibold text-marca-600 hover:underline">
              Ver todos
            </Link>
          </div>
          {avisos.length === 0 ? (
            <Vazio icone={<Bell className="size-6" />} titulo="Nada por aqui" texto="Quando um cliente agendar ou cancelar, você vê aqui e no WhatsApp." />
          ) : (
            <ul className="divide-y divide-linha">
              {avisos.map((a) => (
                <li key={a.id} className="flex gap-3 px-5 py-3.5">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.lida ? "bg-linha-forte" : "bg-marca-500")} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{a.titulo}</p>
                    <p className="text-xs text-suave">{formatarNoFuso(a.createdAt, fuso, "dd/MM 'às' HH:mm")}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {negocio.whatsapp && (
            <div className="border-t border-linha bg-papel-2 px-5 py-3 text-xs text-suave">
              Avisos também vão para o seu WhatsApp{" "}
              <a className="font-semibold text-ink" href={linkWhatsapp(negocio.whatsapp)} target="_blank" rel="noreferrer">
                ({negocio.whatsapp.slice(-4).padStart(8, "•")})
              </a>
            </div>
          )}
        </Cartao>
      </div>
    </div>
  );
}
