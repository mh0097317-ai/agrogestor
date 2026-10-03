"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  MapPin,
  MessageCircle,
  Scissors,
  Share2,
  Camera,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { money } from "@/lib/utils";
import {
  PublicError,
  PublicImage,
  PublicLoading,
  PublicRefreshNotice,
} from "./public-ui";
import { usePublicCatalog } from "./use-public-catalog";
import { businessClock, publicAccentStyle } from "./public-branding";
import { PublicServices } from "./public-services";
import { PublicBusinessDetails, PublicTeam } from "./public-business-details";
import "./public.css";
import "./public-page.css";

export function PublicPage({ slug }: { slug: string }) {
  const { catalog, loading, error, reload } = usePublicCatalog(slug);
  const [toast, setToast] = useState("");
  if (loading && !catalog) return <PublicLoading />;
  if (!catalog)
    return (
      <PublicError
        message={error || "Este estabelecimento não está disponível."}
        retry={reload}
      />
    );

  const { business, services, professionals, settings } = catalog;
  const activeServices = services.filter((service) => service.active);
  const availableTeam = professionals.filter((person) => person.active);
  const whatsapp = `https://wa.me/55${business.phone.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, "")}`;
  const location = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
  const instagram = business.instagram.startsWith("http")
    ? business.instagram
    : `https://instagram.com/${business.instagram.replace("@", "")}`;
  const { weekday, time } = businessClock();
  const isOpen =
    settings.openDays.includes(weekday) &&
    time >= settings.openStart &&
    time < settings.openEnd;
  const firstPrice = activeServices.length
    ? Math.min(...activeServices.map((service) => service.price))
    : undefined;

  async function shareBusiness() {
    try {
      if (navigator.share)
        await navigator.share({
          title: business.name,
          text: "Reserve seu próximo momento de cuidado.",
          url: window.location.href,
        });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setToast("Link copiado. Compartilhe com quem você quiser.");
        setTimeout(() => setToast(""), 4000);
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setToast(
          "Copie o endereço do navegador para compartilhar este estabelecimento.",
        );
        setTimeout(() => setToast(""), 4000);
      }
    }
  }

  return (
    <div className="public-site" style={publicAccentStyle(business.color)}>
      <a className="public-skip-link" href="#conteudo">
        Ir para os serviços
      </a>
      <header className="public-nav">
        <Link href={`/${slug}`} className="public-platform-brand">
          <span>
            <Scissors size={17} />
          </span>
          studio<span className="public-brand-light">flow</span>
        </Link>
        <nav aria-label="Navegação do estabelecimento">
          <a href="#servicos">Serviços</a>
          <a href="#equipe">Profissionais</a>
          <a href="#sobre">O espaço</a>
        </nav>
        <button
          className="public-icon-button"
          aria-label="Compartilhar estabelecimento"
          onClick={shareBusiness}
        >
          <Share2 size={18} />
        </button>
      </header>
      <PublicRefreshNotice error={error} refreshing={loading} retry={reload} />

      <main className="public-main" id="conteudo">
        <section className="public-hero" aria-label={business.name}>
          <PublicImage
            src={business.cover}
            alt={`Ambiente do ${business.name}`}
            className="public-cover"
            segment={business.category}
            priority
          />
          <div className="public-cover-shade" />
          <div className="public-cover-top">
            <span className="public-cover-category">{business.category}</span>
            <span className={`public-open-badge ${isOpen ? "is-open" : ""}`}>
              <i />
              {isOpen ? "Aberto agora" : "Fechado agora"}
            </span>
          </div>
          <div className="public-cover-caption">
            <h1>{business.name}</h1>
            <p>Seu estilo. Seu tempo. Seu lugar.</p>
          </div>
          <a
            href="#servicos"
            className="public-cover-explore"
            aria-label="Explorar serviços"
          >
            <ArrowDown size={20} />
          </a>
        </section>

        <div className="public-content-layout">
          <div className="public-content-main">
            <section className="public-intro">
              <div className="public-intro-top">
                <div>
                  <span className="public-eyebrow">
                    BEM-VINDO AO SEU PRÓXIMO MOMENTO
                  </span>
                  <h2>
                    Cuidado que combina
                    <br />
                    com você.
                  </h2>
                </div>
                <PublicImage
                  src={business.logo}
                  alt={`Identidade do ${business.name}`}
                  className="public-small-logo"
                  fallbackName={business.name}
                  segment={business.category}
                />
              </div>
              <p>{business.description}</p>
              {business.address && (
                <a
                  className="public-intro-location"
                  href={location}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={16} />
                  {business.address}
                  <ArrowRight size={14} />
                </a>
              )}
              <div className="public-social-links">
                {business.address && (
                  <a href={location} target="_blank" rel="noreferrer">
                    <MapPin size={17} />
                    <span>Localização</span>
                  </a>
                )}
                {business.phone && (
                  <a href={whatsapp} target="_blank" rel="noreferrer">
                    <MessageCircle size={17} />
                    <span>WhatsApp</span>
                  </a>
                )}
                {business.instagram && (
                  <a href={instagram} target="_blank" rel="noreferrer">
                    <Camera size={17} />
                    <span>Instagram</span>
                  </a>
                )}
              </div>
              <Link
                href={`/${slug}/agendar`}
                className="public-button public-inline-cta"
              >
                Agendar horário <ArrowRight size={18} />
              </Link>
            </section>

            <PublicServices services={activeServices} slug={slug} />
            <PublicTeam professionals={availableTeam} slug={slug} />
            <PublicBusinessDetails
              business={business}
              settings={settings}
              weekday={weekday}
              location={location}
            />
          </div>

          <aside
            className="public-booking-aside"
            aria-label="Agendamento online"
          >
            <div className="public-reserve-card">
              <div className="public-reserve-heading">
                <span className="public-reserve-icon">
                  <CalendarDays size={22} />
                </span>
                <span className="public-eyebrow">SEU PRÓXIMO HORÁRIO</span>
              </div>
              <h2>
                Reserve um tempo
                <br />
                para você.
              </h2>
              <p>
                Escolha o serviço e encontre o melhor horário para o seu dia.
              </p>
              <dl className="public-reserve-facts">
                <div>
                  <dt>Serviços disponíveis</dt>
                  <dd>{activeServices.length}</dd>
                </div>
                <div>
                  <dt>Profissionais</dt>
                  <dd>{availableTeam.length}</dd>
                </div>
                {firstPrice !== undefined && (
                  <div>
                    <dt>A partir de</dt>
                    <dd>{money(firstPrice)}</dd>
                  </div>
                )}
              </dl>
              <Link href={`/${slug}/agendar`} className="public-button">
                Agendar horário <ArrowRight size={18} />
              </Link>
              <div className="public-reserve-assurance">
                <ShieldCheck size={16} />
                <span>Sem cadastro. Confirmação na hora.</span>
              </div>
              {business.phone && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="public-reserve-help"
                >
                  <MessageCircle size={16} />
                  Prefere conversar? Fale com a gente
                </a>
              )}
            </div>
          </aside>
        </div>
      </main>

      <footer className="public-footer">
        <span>{business.name}</span>
        <span>
          Agendamentos com <strong>studioflow</strong>
        </span>
        <Link href="/login">
          Acesso do estabelecimento <ArrowRight size={14} />
        </Link>
      </footer>
      <div className="public-mobile-dock">
        <div>
          <strong>Seu próximo momento</strong>
          <span>
            {firstPrice !== undefined
              ? `Serviços a partir de ${money(firstPrice)}`
              : business.name}
          </span>
        </div>
        <Link href={`/${slug}/agendar`} className="public-button">
          Agendar <ArrowRight size={17} />
        </Link>
      </div>
      {toast && (
        <div className="public-toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
