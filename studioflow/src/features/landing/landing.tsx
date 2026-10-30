import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  ChartLineUp,
  Check,
  CurrencyCircleDollar,
  DeviceMobile,
  Lock,
  Robot,
  Television,
} from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import { legal } from "@/features/legal/legal";
import { showcaseSlug } from "@/lib/showcase";
import { DayStory, LiveDemo, NoShowCalculator } from "./landing-motion";
import "./landing.css";

const sales = (process.env.NEXT_PUBLIC_SALES_WHATSAPP || "").replace(/\D/g, "");
const whatsapp = sales
  ? `https://wa.me/${sales}?text=${encodeURIComponent("Oi! Quero conhecer o StudioFlow para a minha barbearia.")}`
  : "";
const start = "/login?cadastro=1";

const plans = [
  {
    name: "Essencial",
    tagline: "Para sair do caderno.",
    items: [
      "Página própria da barbearia",
      "Agendamento online 24 horas",
      "Agenda da equipe e clientes",
      "Lembrete no WhatsApp e por e-mail",
      "Financeiro com comissão",
      "Cartão fidelidade e lista de espera",
    ],
  },
  {
    name: "Profissional",
    tagline: "Para lotar a agenda e reduzir faltas.",
    featured: true,
    items: [
      "Tudo do Essencial",
      "Sinal por Pix ao agendar",
      "Clube de assinatura",
      "Venda de produtos com estoque",
      "Check-in por QR Code",
      "Modo TV da recepção",
    ],
  },
  {
    name: "Completo",
    tagline: "Para quem quer uma recepcionista que não dorme.",
    items: [
      "Tudo do Profissional",
      "Recepcionista com IA no WhatsApp",
      "Atendimento no Instagram e no site",
      "Marca o horário com a confirmação do cliente",
      "Aviso ao barbeiro a cada novo horário",
    ],
  },
];

const faq = [
  [
    "O cliente precisa baixar aplicativo?",
    "Não. Ele agenda pela página da barbearia, sem criar senha. Se quiser, instala o ícone da barbearia na tela de início do celular em dois toques.",
  ],
  [
    "Tem fidelidade ou multa?",
    "Não. É mensal e você cancela quando quiser. No plano anual você ganha 2 meses.",
  ],
  [
    "Dá para usar o meu número de WhatsApp?",
    "Sim. Você conecta o número da barbearia lendo um QR Code, como no WhatsApp Web. Cada barbeiro também pode conectar o próprio número para receber os avisos.",
  ],
  [
    "E se a IA responder errado?",
    "Ela só marca com a confirmação do cliente e confere o horário na agenda antes de gravar. Quando não sabe, chama alguém da equipe. Você acompanha todas as conversas no painel.",
  ],
  [
    "Quanto tempo para começar?",
    "No mesmo dia. Você cadastra serviços, fotos e equipe, ou a gente faz isso junto com você.",
  ],
  [
    "Meus dados e os dos meus clientes ficam seguros?",
    "Sim. Cada barbearia tem seus dados separados, as chaves ficam cifradas e seguimos a LGPD. Os dados são seus e você pode exportar quando quiser.",
  ],
] as const;

function Cta({ dark = false, demo = false }: { dark?: boolean; demo?: boolean }) {
  return (
    <div className="lp-ctas">
      <Link href={start} className={`lp-btn ${dark ? "is-light" : ""}`}>
        Testar grátis <ArrowRight size={18} weight="bold" />
      </Link>
      {demo && (
        <Link href={`/${showcaseSlug}`} className="lp-btn-ghost">
          Ver demonstração ao vivo
        </Link>
      )}
      {whatsapp && (
        <a href={whatsapp} className={`lp-btn-ghost ${dark ? "is-light" : ""}`} target="_blank" rel="noreferrer">
          <WhatsAppIcon size={18} /> Falar no WhatsApp
        </a>
      )}
    </div>
  );
}

/** Site de vendas do StudioFlow (studioflowapp.tech). */
export function Landing() {
  return (
    <div className="lp">
      <header className="lp-top">
        <Link href="/" className="lp-logo" aria-label="StudioFlow">
          Studio<i>Flow</i>
        </Link>
        <nav aria-label="Seções">
          <a href="#como-funciona">Como funciona</a>
          <a href="#precos">Planos</a>
          <a href="#perguntas">Perguntas</a>
        </nav>
        <div className="lp-top-actions">
          <Link href="/login" className="lp-link">
            Entrar
          </Link>
          <Link href={start} className="lp-btn is-small">
            Testar grátis
          </Link>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-text">
            <p className="lp-eyebrow">Para barbearias</p>
            <h1>
              Sua barbearia agendando <em>sozinha</em>, 24 horas.
            </h1>
            <p className="lp-lead">
              Página própria, agenda online, lembrete no WhatsApp e uma recepcionista com IA que responde enquanto você corta.
              Tudo numa assinatura só.
            </p>
            <Cta demo />
            <ul className="lp-trust">
              <li><Check size={16} weight="bold" /> Sem app para o cliente baixar</li>
              <li><Check size={16} weight="bold" /> Sem fidelidade</li>
              <li><Check size={16} weight="bold" /> Pronto no mesmo dia</li>
            </ul>
          </div>
          <div className="lp-hero-art" aria-hidden="true">
            <img className="lp-shot-desk" src="/landing/salon.webp" alt="" width={1600} height={1000} />
            <LiveDemo />
          </div>
        </section>

        <section className="lp-pains" aria-label="Problemas que o StudioFlow resolve">
          {[
            ["Responde WhatsApp entre um corte e outro?", "A recepcionista com IA responde por você."],
            ["Cliente marca e esquece?", "Lembrete automático e sinal por Pix."],
            ["Dois clientes no mesmo horário?", "A agenda trava sozinha."],
            ["Não sabe quanto entrou no mês?", "Financeiro e comissão sem planilha."],
          ].map(([q, a], index) => (
            <article key={q} data-reveal style={{ "--reveal-i": index } as CSSProperties}>
              <strong>{q}</strong>
              <span>{a}</span>
            </article>
          ))}
        </section>

        <DayStory />

        <section className="lp-feature" data-reveal>
          <div className="lp-feature-text">
            <p className="lp-eyebrow">Página e agendamento</p>
            <h2>Uma página que vende, com o botão de agendar no topo.</h2>
            <p>
              Fotos dos cortes, serviços com preço, equipe, mapa, Instagram e avaliações de quem foi atendido. O cliente escolhe
              serviço, barbeiro e horário em menos de um minuto, sem criar senha.
            </p>
            <ul className="lp-list">
              <li><CalendarCheck size={20} weight="duotone" /> Só mostra horário livre de verdade</li>
              <li><DeviceMobile size={20} weight="duotone" /> Vira app na tela de início do cliente</li>
              <li><Bell size={20} weight="duotone" /> Lembrete no WhatsApp e por e-mail</li>
            </ul>
            <Link href={`/${showcaseSlug}`} className="lp-btn is-outline">
              Agendar na barbearia de exemplo <ArrowRight size={18} weight="bold" />
            </Link>
          </div>
          <div className="lp-phone is-solo">
            <img src="/landing/phone-book.webp" alt="Tela de agendamento com serviços, fotos e preços" width={780} height={1688} loading="lazy" />
          </div>
        </section>

        <section className="lp-feature is-dark">
          <div className="lp-feature-text">
            <p className="lp-eyebrow">Recepcionista com IA</p>
            <h2>02:13 da manhã. Chegou mensagem. E foi respondida.</h2>
            <p>
              Ela tira dúvidas de preço, mostra os horários livres e marca o horário quando o cliente confirma. O barbeiro
              recebe o aviso no WhatsApp dele. Você só entra quando quiser.
            </p>
            <ul className="lp-list">
              <li><Robot size={20} weight="duotone" /> No WhatsApp, no Instagram e no site</li>
              <li><Lock size={20} weight="duotone" /> Nunca marca sem a confirmação do cliente</li>
            </ul>
          </div>
          <div className="lp-chat" aria-label="Exemplo de conversa">
            <p className="in">Boa noite! Tem horário amanhã à tarde pra corte e barba?</p>
            <p className="out">Tenho sim! Amanhã às 14:30 com o Lucas ou 16:00 com o João. Qual prefere?</p>
            <p className="in">14:30 com o Lucas</p>
            <p className="out">Posso confirmar Corte + barba amanhã às 14:30 com o Lucas?</p>
            <p className="in">Pode</p>
            <p className="out is-done"><Check size={15} weight="bold" /> Tudo certo! Agendamento confirmado. Te mando um lembrete antes.</p>
          </div>
        </section>

        <section className="lp-feature is-wide" data-reveal>
          <div className="lp-feature-text">
            <p className="lp-eyebrow">Painel do dono</p>
            <h2>Sua barbearia ao vivo, vista de cima.</h2>
            <p>
              Cada cadeira mostra quem está sendo atendido, quanto falta e quem vem depois. Quem chegou espera no sofá.
              Concluir e cobrar é um toque, e o caixa do dia muda na hora. No computador ou no celular.
            </p>
            <ul className="lp-list is-row">
              <li><ChartLineUp size={20} weight="duotone" /> Relatórios por canal</li>
              <li><CurrencyCircleDollar size={20} weight="duotone" /> Sinal por Pix e clube de assinatura</li>
            </ul>
          </div>
          <img className="lp-shot-wide" src="/landing/salon.webp" alt="Salão ao vivo: as cadeiras vistas de cima com o barbeiro, o cliente e o tempo que falta" width={1600} height={1000} loading="lazy" />
        </section>

        <section className="lp-feature is-wide is-reverse" data-reveal>
          <div className="lp-feature-text">
            <p className="lp-eyebrow">Modo TV da recepção</p>
            <h2>A TV da barbearia vira vitrine.</h2>
            <p>
              Quem está sendo atendido, quem chega em seguida, serviços com foto e preço, vagas de hoje e o QR Code para o
              próximo cliente já sair agendado.
            </p>
            <ul className="lp-list is-row">
              <li><Television size={20} weight="duotone" /> Qualquer smart TV com navegador</li>
            </ul>
          </div>
          <img className="lp-shot-wide" src="/landing/tv.webp" alt="Modo TV com fila, equipe e vitrine de serviços" width={1600} height={900} loading="lazy" />
        </section>

        <section className="lp-steps" id="como-funciona">
          <p className="lp-eyebrow">Como funciona</p>
          <h2>Começa hoje, sem complicação.</h2>
          <ol>
            <li data-reveal>
              <b>1</b>
              <strong>Crie sua conta</strong>
              <span>Nome da barbearia, serviços, preços e equipe. Leva uns 10 minutos.</span>
            </li>
            <li data-reveal>
              <b>2</b>
              <strong>Conecte o WhatsApp</strong>
              <span>Leia o QR Code com o celular da barbearia, como no WhatsApp Web.</span>
            </li>
            <li data-reveal>
              <b>3</b>
              <strong>Divulgue o link</strong>
              <span>Na bio do Instagram, no WhatsApp e no QR Code do balcão. Pronto.</span>
            </li>
          </ol>
        </section>

        <NoShowCalculator />

        <section className="lp-pricing" id="precos">
          <p className="lp-eyebrow">Planos</p>
          <h2>Um plano para cada momento da barbearia.</h2>
          <p className="lp-offer">
            <b>Oferta de lançamento:</b> as 10 primeiras barbearias pagam metade nos 3 primeiros meses. No plano anual, 2 meses grátis.
          </p>
          <div className="lp-plans">
            {plans.map((plan, index) => (
              <article
                key={plan.name}
                className={plan.featured ? "is-featured" : ""}
                data-reveal
                style={{ "--reveal-i": index } as CSSProperties}
              >
                {plan.featured && <span className="lp-badge">Mais escolhido</span>}
                <h3>{plan.name}</h3>
                <p className="lp-plan-tag">{plan.tagline}</p>
                <ul>
                  {plan.items.map((item) => (
                    <li key={item}>
                      <Check size={16} weight="bold" /> {item}
                    </li>
                  ))}
                </ul>
                {whatsapp ? (
                  <a
                    href={`https://wa.me/${sales}?text=${encodeURIComponent(`Oi! Quero saber o valor do plano ${plan.name} do StudioFlow.`)}`}
                    className={`lp-btn ${plan.featured ? "" : "is-outline"}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <WhatsAppIcon size={17} /> Consultar valor
                  </a>
                ) : (
                  <Link href={start} className={`lp-btn ${plan.featured ? "" : "is-outline"}`}>
                    Começar com o {plan.name}
                  </Link>
                )}
              </article>
            ))}
          </div>
          <p className="lp-fine">Sem taxa de adesão e sem fidelidade. A recepcionista com IA tem uso justo incluso no plano Completo.</p>
        </section>

        <section className="lp-faq" id="perguntas">
          <p className="lp-eyebrow">Perguntas</p>
          <h2>O que os donos perguntam.</h2>
          {faq.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>

        <section className="lp-final">
          <h2>Página, agenda e recepcionista. Tudo numa assinatura.</h2>
          <p>Feito para barbearia, do jeito da sua barbearia.</p>
          <Cta dark />
        </section>
      </main>

      <footer className="lp-foot">
        <span className="lp-logo">
          Studio<i>Flow</i>
        </span>
        <nav aria-label="Rodapé">
          <Link href="/termos">Termos de Uso</Link>
          <Link href="/privacidade">Privacidade</Link>
          <a href={`mailto:${legal.email}`}>{legal.email}</a>
          <Link href="/login">Entrar</Link>
        </nav>
      </footer>
    </div>
  );
}
