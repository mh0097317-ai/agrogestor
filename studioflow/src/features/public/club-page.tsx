"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowSquareOut,
  CalendarCheck,
  IdentificationCard,
  LockSimple,
  Seal,
  User,
} from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import { BookingChrome } from "@/features/booking/booking-chrome";
import { BookingLoader } from "@/features/booking/booking-intro";
import { StepHead } from "@/features/booking/selection-steps";
import {
  phoneMask,
  validBrazilianPhone,
} from "@/features/booking/customer-step";
import { formatCpf, isValidCpf, monthKey } from "@/lib/payments";
import { money } from "@/lib/utils";
import { BusyButton, PublicError } from "./public-ui";
import { publicRequest, usePublicCatalog } from "./use-public-catalog";
import {
  forgetClubToken,
  readClubToken,
  saveClubToken,
  useMembership,
  type MemberView,
} from "./club";
import type { PublicCatalog, PublicPlan } from "./types";

export function ClubPage({ slug }: { slug: string }) {
  const { catalog, loading, error, reload } = usePublicCatalog(slug);
  if (loading && !catalog) return <BookingLoader />;
  if (!catalog)
    return (
      <PublicError
        message={error || "Estabelecimento indisponível."}
        retry={reload}
      />
    );
  return <ClubContent catalog={catalog} />;
}

function ClubContent({ catalog }: { catalog: PublicCatalog }) {
  const { business } = catalog;
  const router = useRouter();
  const query = useSearchParams();
  // Rendered only after the catalog loads in the browser.
  const [token, setToken] = useState(() => {
    const shared = query.get("acesso") || "";
    if (/^[a-f0-9]{64}$/.test(shared)) {
      saveClubToken(business.slug, shared);
      return shared;
    }
    return readClubToken(business.slug);
  });
  useEffect(() => {
    // The access link is personal: keep it out of the address bar.
    if (query.get("acesso")) router.replace(`/${business.slug}/clube`);
  }, [query, router, business.slug]);
  const [check, setCheck] = useState(false);
  const { member, error, loading, reload } = useMembership(
    business.slug,
    token,
    check,
  );
  function leave() {
    forgetClubToken(business.slug);
    setToken("");
  }
  const plans = catalog.onlinePayments ? catalog.plans || [] : [];
  return (
    <BookingChrome
      business={business}
      step={1}
      showSteps={false}
      subtitle="Clube de assinatura"
    >
      <div className="bk-screen is-forward">
        {token && member ? (
          <MemberCard
            member={member}
            slug={business.slug}
            catalog={catalog}
            onCheck={() => {
              setCheck(true);
              reload();
            }}
            checking={loading}
            onLeave={leave}
          />
        ) : token && loading ? (
          <div className="bk-club-wait" aria-busy="true">
            <span className="bk-loader-rule" />
          </div>
        ) : token && error ? (
          <div className="bk-alert" role="alert">
            <p>{error}</p>
            <button type="button" onClick={leave}>
              Usar outro acesso
            </button>
          </div>
        ) : plans.length ? (
          <Subscribe
            catalog={catalog}
            plans={plans}
            onDone={(value) => {
              saveClubToken(business.slug, value);
              setToken(value);
            }}
          />
        ) : (
          <section className="bk-step">
            <StepHead
              title="Clube em breve"
              text={`A ${business.name} ainda não abriu planos de assinatura. Você pode agendar normalmente.`}
            />
            <Link className="bk-primary" href={`/${business.slug}/agendar`}>
              Agendar um horário <ArrowRight weight="bold" size={17} />
            </Link>
          </section>
        )}
      </div>
    </BookingChrome>
  );
}

function PlanLines({
  plan,
  catalog,
}: {
  plan: PublicPlan;
  catalog: PublicCatalog;
}) {
  return (
    <>
      <span className="bk-club-plan-services">
        {plan.serviceIds
          .map(
            (id) => catalog.services.find((service) => service.id === id)?.name,
          )
          .filter(Boolean)
          .join(" · ")}
      </span>
      <span className="bk-club-plan-limit">
        {plan.monthlyLimit
          ? `Até ${plan.monthlyLimit} ${plan.monthlyLimit === 1 ? "atendimento" : "atendimentos"} por mês`
          : "Quantas vezes quiser no mês"}
      </span>
    </>
  );
}

function Subscribe({
  catalog,
  plans,
  onDone,
}: {
  catalog: PublicCatalog;
  plans: PublicPlan[];
  onDone: (token: string) => void;
}) {
  const { business } = catalog;
  const [planId, setPlanId] = useState(plans[0].id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const plan = plans.find((item) => item.id === planId) || plans[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 3) return setError("Informe seu nome completo.");
    if (!validBrazilianPhone(phone))
      return setError("Informe um WhatsApp válido com DDD.");
    if (!isValidCpf(cpf)) return setError("Informe um CPF válido.");
    // Opened now so the browser lets the invoice open in a new tab.
    const tab = window.open("", "_blank");
    setBusy(true);
    setError("");
    try {
      const result = await publicRequest<{
        token: string;
        invoiceUrl: string | null;
      }>(`/api/public/${business.slug}/club`, {
        method: "POST",
        body: JSON.stringify({ planId, name, phone, cpf, email }),
      });
      if (result.invoiceUrl && tab) tab.location.href = result.invoiceUrl;
      else tab?.close();
      onDone(result.token);
    } catch (cause) {
      tab?.close();
      setError(
        cause instanceof Error ? cause.message : "Não foi possível assinar.",
      );
      setBusy(false);
    }
  }

  return (
    <section className="bk-step">
      <StepHead
        title="Assine e agende sem pagar na hora"
        text={`Escolha um plano da ${business.name}. Os serviços inclusos saem do seu clube a cada visita.`}
      />
      <ul className="bk-list bk-club-plans" role="list">
        {plans.map((item, index) => (
          <li key={item.id} style={{ "--i": index } as CSSProperties}>
            <button
              type="button"
              className={`bk-option bk-club-plan ${item.id === planId ? "is-selected" : ""}`}
              aria-pressed={item.id === planId}
              onClick={() => setPlanId(item.id)}
            >
              <span className="bk-club-plan-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="bk-option-body">
                <strong>{item.name}</strong>
                <PlanLines plan={item} catalog={catalog} />
                {item.description && (
                  <span className="bk-club-plan-text">{item.description}</span>
                )}
              </span>
              <b className="bk-club-plan-price">
                {money(item.price)}
                <small>/mês</small>
              </b>
            </button>
          </li>
        ))}
      </ul>
      <form className="bk-form" onSubmit={submit} noValidate>
        <label htmlFor="club-name">
          <span className="bk-label">Seu nome</span>
          <span className="bk-input">
            <User weight="duotone" size={18} />
            <input
              id="club-name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              placeholder="Nome completo"
            />
          </span>
        </label>
        <label htmlFor="club-phone">
          <span className="bk-label">WhatsApp</span>
          <span className="bk-input">
            <WhatsAppIcon size={18} />
            <input
              id="club-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={phone}
              onChange={(event) => setPhone(phoneMask(event.target.value))}
              placeholder="(11) 99999-9999"
            />
          </span>
          <span className="bk-field-help">
            Use este número para agendar pelo clube.
          </span>
        </label>
        <label htmlFor="club-cpf">
          <span className="bk-label">CPF</span>
          <span className="bk-input">
            <IdentificationCard weight="duotone" size={18} />
            <input
              id="club-cpf"
              inputMode="numeric"
              autoComplete="off"
              value={cpf}
              onChange={(event) => setCpf(formatCpf(event.target.value))}
              placeholder="000.000.000-00"
            />
          </span>
          <span className="bk-field-help">
            Exigido para emitir as cobranças. Vai só para o Asaas.
          </span>
        </label>
        <label htmlFor="club-email">
          <span className="bk-label">E-mail (opcional)</span>
          <span className="bk-input">
            <input
              id="club-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Para receber as faturas"
            />
          </span>
        </label>
        {error && (
          <div className="bk-alert" role="alert">
            <p>{error}</p>
          </div>
        )}
        <BusyButton type="submit" busy={busy} className="bk-primary">
          Assinar por {money(plan.price)}/mês
        </BusyButton>
        <p className="bk-safe">
          <LockSimple weight="duotone" size={14} /> Cobrança mensal feita pelo
          Asaas para a {business.name}. Na fatura você escolhe Pix, boleto ou
          cartão.
        </p>
      </form>
    </section>
  );
}

const nextDue = (day: string | null) =>
  day
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        timeZone: "UTC",
      }).format(new Date(`${day}T12:00:00Z`))
    : "";

function MemberCard({
  member,
  slug,
  catalog,
  onCheck,
  checking,
  onLeave,
}: {
  member: MemberView;
  slug: string;
  catalog: PublicCatalog;
  onCheck: () => void;
  checking: boolean;
  onLeave: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const used = member.usage[monthKey(new Date())] || 0;
  const limit = member.plan?.monthlyLimit;
  const first = member.customerName.split(" ")[0];
  async function simulate() {
    if (!member.simulatedCharge) return;
    setBusy(true);
    try {
      await publicRequest(`/api/demo/charges/${member.simulatedCharge}`, {
        method: "POST",
      });
      onCheck();
    } finally {
      setBusy(false);
    }
  }
  const headline = {
    active: `Seu clube está ativo, ${first}`,
    pending: "Falta a primeira mensalidade",
    overdue: "Mensalidade em aberto",
    cancelled: "Assinatura cancelada",
  }[member.status];
  const text = {
    active: "Agende os serviços do plano sem pagar na hora.",
    pending:
      "Assim que o pagamento cair, o clube fica ativo e você já pode agendar por ele.",
    overdue:
      "O clube volta a valer assim que a mensalidade for paga.",
    cancelled:
      "Esta assinatura não está mais ativa. Fale com o estabelecimento para voltar.",
  }[member.status];
  return (
    <section className="bk-step">
      <StepHead title={headline} text={text} />
      <div className={`bk-club-card is-${member.status}`}>
        <span className="bk-club-card-seal" aria-hidden="true">
          <Seal weight="duotone" size={22} />
        </span>
        <small>{catalog.business.name}</small>
        <strong>{member.plan?.name || "Clube"}</strong>
        {member.plan && <PlanLines plan={member.plan} catalog={catalog} />}
        {member.status === "active" && (
          <dl>
            <div>
              <dt>Neste mês</dt>
              <dd>
                {used}
                {limit ? ` de ${limit}` : ""}{" "}
                {used === 1 ? "atendimento" : "atendimentos"}
              </dd>
            </div>
            {member.nextDueDate && (
              <div>
                <dt>Próxima mensalidade</dt>
                <dd>{nextDue(member.nextDueDate)}</dd>
              </div>
            )}
          </dl>
        )}
        <span className="bk-club-card-price">
          {money(member.price)}/mês
        </span>
      </div>
      <div className="bk-actions">
        {member.status === "active" && (
          <Link className="bk-primary" href={`/${slug}/agendar`}>
            <CalendarCheck weight="duotone" size={18} /> Agendar pelo clube
          </Link>
        )}
        {(member.status === "pending" || member.status === "overdue") && (
          <>
            {member.invoiceUrl && (
              <a
                className="bk-primary"
                href={member.invoiceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Pagar mensalidade <ArrowSquareOut weight="bold" size={16} />
              </a>
            )}
            {member.simulatedCharge && (
              <button
                type="button"
                className="bk-primary"
                onClick={simulate}
                disabled={busy}
              >
                Simular pagamento (demonstração)
              </button>
            )}
            <button
              type="button"
              className="bk-secondary"
              onClick={onCheck}
              disabled={checking}
            >
              {checking ? "Conferindo…" : "Já paguei, conferir"}
            </button>
          </>
        )}
        <button type="button" className="bk-secondary is-quiet" onClick={onLeave}>
          Não é você? Sair deste aparelho
        </button>
      </div>
    </section>
  );
}
