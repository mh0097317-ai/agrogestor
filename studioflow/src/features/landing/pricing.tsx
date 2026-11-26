import Link from "next/link";
import { ArrowRight, Check } from "@phosphor-icons/react/dist/ssr";
import {
  annualSaving,
  baseFeatures,
  moduleFeature,
  priceLabel,
  type PlatformPlan,
} from "@/lib/platform-plans";
import "./landing.css";

const start = "/login?cadastro=1";

/**
 * Página pública de preços. Os valores vêm de platform_plans (definidos no
 * /admin); sem valor definido, mostra "Sob consulta" em vez de inventar.
 */
export function Pricing({
  plans,
  trialDays,
}: {
  plans: PlatformPlan[];
  trialDays: number;
}) {
  const priced = plans.some((p) => p.monthlyCents !== null);
  return (
    <div className="lp">
      <header className="lp-top">
        <Link href="/" className="lp-logo" aria-label="StudioFlow">
          Studio<i>Flow</i>
        </Link>
        <nav aria-label="Seções">
          <Link href="/#como-funciona">Como funciona</Link>
          <Link href="/precos" aria-current="page">
            Planos
          </Link>
          <Link href="/#perguntas">Perguntas</Link>
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
      <main className="pr">
        <section className="pr-head">
          <span className="lp-eyebrow">Planos</span>
          <h1>
            Um preço por barbearia. <em>Sem comissão</em> por cliente.
          </h1>
          <p>
            {trialDays > 0
              ? `${trialDays} dias para testar sem pagar. `
              : ""}
            Sem fidelidade: muda de plano ou cancela quando quiser, pelo
            próprio painel.
          </p>
        </section>
        <section className="pr-grid" aria-label="Planos">
          {plans.map((plan) => {
            const saving = annualSaving(plan);
            return (
              <article
                key={plan.key}
                className={`pr-card ${plan.highlight ? "is-highlight" : ""}`}
              >
                {plan.highlight && <span className="pr-badge">Mais escolhido</span>}
                <h2>{plan.name}</h2>
                <p className="pr-tagline">{plan.tagline}</p>
                <div className="pr-price">
                  <strong>{priceLabel(plan.monthlyCents)}</strong>
                  {plan.monthlyCents !== null && <span>/mês</span>}
                </div>
                {plan.annualCents !== null && (
                  <p className="pr-annual">
                    ou {priceLabel(plan.annualCents)} no anual
                    {saving > 0 && ` (economia de ${priceLabel(saving)})`}
                  </p>
                )}
                <Link href={start} className={`lp-btn ${plan.highlight ? "" : "is-outline"}`}>
                  Começar o teste <ArrowRight size={17} weight="bold" />
                </Link>
                <ul role="list">
                  {baseFeatures.map((f) => (
                    <li key={f}>
                      <Check size={16} weight="bold" aria-hidden="true" /> {f}
                    </li>
                  ))}
                  {plan.modules.map((m) => (
                    <li key={m} className="is-module">
                      <Check size={16} weight="bold" aria-hidden="true" />{" "}
                      {moduleFeature(m)}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>
        <section className="pr-notes">
          <p>
            {priced
              ? "Valores em reais, por estabelecimento. A cobrança da assinatura é separada do dinheiro dos seus clientes: o sinal no Pix e o clube caem direto na conta Asaas da barbearia."
              : "Os valores estão sendo definidos para o lançamento. Fale com a gente para receber a proposta da sua barbearia."}
          </p>
          <p>
            Custos de terceiros que dependem do seu uso (taxas do Asaas e
            conversas da API oficial do WhatsApp) são cobrados por eles, não
            pelo StudioFlow.
          </p>
        </section>
      </main>
    </div>
  );
}
