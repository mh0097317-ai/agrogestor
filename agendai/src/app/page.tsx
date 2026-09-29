import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  CalendarX2,
  Clock3,
  Link2,
  Palette,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import { classesBotao, Logo } from "@/components/ui";
import { TIPOS_NEGOCIO } from "@/lib/tipos-negocio";

const TIPOS = ["BARBEARIA", "SALAO_FEMININO", "SALAO_MASCULINO", "SALAO_UNISSEX", "ESTETICA", "MANICURE"] as const;

function BolhaWhats({ de, hora, children, className }: { de: string; hora: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-72 rounded-2xl rounded-tl-md bg-white p-3 text-[13px] leading-snug text-ink shadow-flutuante ${className ?? ""}`}>
      <p className="mb-1 text-xs font-bold text-[#128C4B]">{de}</p>
      {children}
      <p className="mt-1 text-right text-[10px] text-apagado">{hora} ✓✓</p>
    </div>
  );
}

function CelularDemo() {
  const horas = ["09:00", "09:30", "10:00", "10:30", "11:00", "14:00", "14:30", "15:00"];
  return (
    <div className="relative mx-auto w-[280px]">
      <div className="rounded-[44px] border-[10px] border-ink bg-ink shadow-2xl">
        <div className="overflow-hidden rounded-[34px] bg-fundo">
          <div className="relative bg-ink px-5 pb-10 pt-8 text-white">
            <div className="listras absolute inset-0 opacity-70" />
            <div className="relative flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-[#C8872E] font-display text-lg font-extrabold">D</span>
              <div>
                <p className="font-display text-lg font-bold leading-tight">Dom Bigode</p>
                <p className="text-[11px] text-white/60">💈 Barbearia · Aberto agora</p>
              </div>
            </div>
          </div>
          <div className="relative -mt-6 mx-3 mb-4 rounded-2xl bg-papel p-3.5 shadow-cartao">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-suave">Passo 3 de 4</p>
            <p className="font-display text-base font-bold text-ink">Quando fica bom?</p>
            <div className="mt-2.5 flex gap-1.5">
              {[["qua", 1], ["qui", 2], ["sex", 3], ["sáb", 4]].map(([d, n], i) => (
                <div
                  key={d}
                  className={`flex w-12 flex-col items-center rounded-xl border py-1.5 ${i === 1 ? "border-transparent bg-[#C8872E] text-white" : "border-linha"}`}
                >
                  <span className="text-[9px] font-semibold uppercase opacity-70">{d}</span>
                  <span className="font-display text-sm font-bold">{n}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {horas.map((h, i) => (
                <span
                  key={h}
                  className={`grid h-8 place-items-center rounded-lg border text-[11px] font-semibold ${i === 5 ? "border-transparent bg-[#C8872E] text-white" : "border-linha text-ink"}`}
                >
                  {h}
                </span>
              ))}
            </div>
            <span className="mt-3 grid h-9 place-items-center rounded-xl bg-[#C8872E] text-xs font-bold text-white">Continuar · Qui às 14:00</span>
          </div>
        </div>
      </div>
      <div className="absolute -right-4 top-24 hidden animate-surgir sm:block lg:-right-40" style={{ animationDelay: "400ms" }}>
        <BolhaWhats de="Agendaí → você" hora="10:42">
          🔔 <strong>Novo agendamento</strong>
          <br />
          👤 Rafael · (11) 98877-1122
          <br />
          ✂️ Corte + Barba com Léo
          <br />
          📅 quinta, 02/10 às <strong>14:00</strong>
        </BolhaWhats>
      </div>
      <div className="absolute -left-6 bottom-10 hidden animate-surgir sm:block lg:-left-44" style={{ animationDelay: "800ms" }}>
        <BolhaWhats de="Dom Bigode → cliente" hora="10:42">
          Olá, Rafael! ✅ Seu horário está <strong>confirmado</strong>. Até quinta às 14:00! 💈
        </BolhaWhats>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="overflow-x-clip">
      {/* Topo */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Logo claro />
          <nav className="flex items-center gap-2">
            <Link href="/entrar" className="rounded-xl px-3 py-2 text-sm font-semibold text-white/80 hover:text-white">
              Entrar
            </Link>
            <Link href="/cadastro" className={classesBotao("primario", "sm")}>
              Criar agenda grátis
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-ink pb-24 pt-32 text-white sm:pb-32 sm:pt-40">
        <div className="grao absolute inset-0" />
        <div className="absolute left-1/2 top-0 size-[40rem] -translate-x-1/2 rounded-full bg-marca-500/25 blur-[120px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              Barbearias · Salões femininos · Salões masculinos
            </p>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
              Cadeira cheia,
              <br />
              <span className="text-marca-400">WhatsApp em paz.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-white/70">
              Seu cliente marca o horário sozinho pelo link, 24h por dia. Ele recebe a confirmação e o lembrete no WhatsApp — e você fica sabendo na hora.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/cadastro" className={classesBotao("primario", "lg")}>
                Criar minha agenda <ArrowRight className="size-5" />
              </Link>
              <Link href="/dom-bigode" className={classesBotao("secundario", "lg", "border-white/15 bg-white/5 text-white hover:bg-white/10")}>
                Ver exemplo
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/50">Grátis para começar · Sem cartão · Pronto em 1 minuto</p>
          </div>
          <CelularDemo />
        </div>
      </section>

      {/* Para quem */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="max-w-2xl font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Um sistema, vários negócios. Cada um com a sua cara.
        </h2>
        <p className="mt-3 max-w-2xl text-suave">
          Cada estabelecimento tem sua própria página, cores, equipe, serviços e horários. Os dados de um nunca se misturam com os de outro.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
          {TIPOS.map((t) => {
            const info = TIPOS_NEGOCIO[t];
            return (
              <Link
                key={t}
                href={`/cadastro?tipo=${t}`}
                className="group relative overflow-hidden rounded-2xl border border-linha bg-papel p-5 transition hover:-translate-y-1 hover:shadow-flutuante"
              >
                <div className="absolute -right-6 -top-6 size-24 rounded-full opacity-15 transition group-hover:scale-125" style={{ background: info.cor }} />
                <span className="text-3xl">{info.emoji}</span>
                <p className="mt-3 font-display text-lg font-bold text-ink">{info.rotulo}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: info.cor }}>
                  Começar <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Como funciona */}
      <section className="bg-papel py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Como funciona</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { n: "1", icone: Link2, t: "Crie sua agenda", d: "Cadastre-se e já recebe serviços, preços e horários sugeridos para o seu tipo de negócio. Ajuste o que quiser." },
              { n: "2", icone: Smartphone, t: "Divulgue seu link", d: "Bio do Instagram, status do WhatsApp, Google Maps. O cliente escolhe serviço, profissional, dia e hora." },
              { n: "3", icone: BellRing, t: "Todo mundo avisado", d: "Cliente recebe confirmação e lembrete. Você recebe cada novo horário e cancelamento no WhatsApp e no painel." },
            ].map((p) => (
              <div key={p.n} className="relative rounded-3xl bg-fundo p-6">
                <span className="absolute right-6 top-4 font-display text-6xl font-extrabold text-ink/5">{p.n}</span>
                <span className="grid size-12 place-items-center rounded-2xl bg-marca-500 text-white shadow-lg shadow-marca-500/30">
                  <p.icone className="size-6" />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold text-ink">{p.t}</h3>
                <p className="mt-2 text-suave">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="max-w-xl font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Tudo que a sua agenda precisa. Nada que atrapalhe.</h2>
        <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icone: CalendarCheck2, t: "Agenda visual por profissional", d: "Veja o dia em colunas, com a linha do “agora”. Toque para confirmar, concluir ou marcar falta." },
            { icone: BellRing, t: "Lembrete automático", d: "Menos faltas: o cliente recebe um lembrete antes do horário, com link para cancelar e liberar a vaga." },
            { icone: ShieldCheck, t: "Zero horário duplicado", d: "Dois clientes nunca conseguem o mesmo horário — nem clicando no mesmo segundo." },
            { icone: Users, t: "Equipe e jornadas", d: "Cada profissional com seus serviços, dias de trabalho e pausa para o almoço." },
            { icone: CalendarX2, t: "Folgas e feriados", d: "Bloqueie um dia ou um período com um toque. Ninguém agenda nesse horário." },
            { icone: Palette, t: "Página com a sua marca", d: "Sua cor, seu nome, endereço, Instagram e WhatsApp. Link curto e bonito para divulgar." },
            { icone: Clock3, t: "Suas regras", d: "Antecedência mínima, até quantos dias à frente, confirmação automática ou manual." },
            { icone: Users, t: "Base de clientes", d: "Histórico de visitas, faltas e quanto cada cliente já gastou. Chame no WhatsApp com um toque." },
            { icone: Smartphone, t: "Feito para o celular", d: "Painel e página de agendamento pensados para usar com uma mão, entre um corte e outro." },
          ].map((f) => (
            <div key={f.t} className="flex gap-4">
              <f.icone className="mt-1 size-6 shrink-0 text-marca-500" />
              <div>
                <h3 className="font-display text-lg font-bold text-ink">{f.t}</h3>
                <p className="mt-1 text-suave">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-marca-500 px-6 py-14 text-center text-white sm:py-20">
          <div className="listras absolute inset-0" />
          <div className="relative">
            <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Bora encher essa agenda?</h2>
            <p className="mx-auto mt-3 max-w-lg text-white/85">Crie sua página de agendamento agora e mande o link para os seus clientes ainda hoje.</p>
            <Link href="/cadastro" className={classesBotao("escuro", "lg", "mt-8")}>
              Criar agenda grátis <ArrowRight className="size-5" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-linha py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-suave sm:px-6">
          <Logo />
          <p>Feito para quem vive de horário marcado. © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
