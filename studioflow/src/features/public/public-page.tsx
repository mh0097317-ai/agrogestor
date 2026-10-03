"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  MapPin,
  ShareNetwork,
} from "@phosphor-icons/react/dist/ssr";
import {
  InstagramIcon,
  MapPinIcon,
  WhatsAppIcon,
} from "@/components/brand-icons";
import { useEffect, useRef, useState } from "react";
import { SegmentIcon } from "@/lib/segments";
import { BrandLogo } from "@/components/brand";
import {
  PublicError,
  PublicImage,
  PublicLoading,
  PublicRefreshNotice,
} from "./public-ui";
import { usePublicCatalog } from "./use-public-catalog";
import { businessClock, publicAccentStyle } from "./public-branding";
import { PublicServices } from "./public-services";
import {
  PublicAmbience,
  PublicAmenities,
  PublicTeam,
  PublicVisit,
} from "./public-business-details";
import "./public.css";
import "./public-page.css";

const shortDays = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

export function PublicPage({ slug }: { slug: string }) {
  const { catalog, loading, error, reload } = usePublicCatalog(slug);
  const [toast, setToast] = useState("");
  const [showDock, setShowDock] = useState(false);
  const mainCta = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const target = mainCta.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setShowDock(!entry.isIntersecting && entry.boundingClientRect.top < 0),
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [catalog]);

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
  const phone = business.phone.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, "");
  const whatsapp = phone ? `https://wa.me/55${phone}` : "";
  const location = business.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`
    : "";
  const instagram = !business.instagram
    ? ""
    : business.instagram.startsWith("http")
      ? business.instagram
      : `https://instagram.com/${business.instagram.replace("@", "")}`;
  const { weekday, time } = businessClock();
  const openToday = settings.openDays.includes(weekday);
  const isOpen =
    openToday && time >= settings.openStart && time < settings.openEnd;
  const statusNote = isOpen
    ? `Fecha às ${settings.openEnd}`
    : nextOpening(settings.openDays, weekday, time, settings.openStart);
  const bookHref = `/${slug}/agendar`;
  const ambiencePhoto = business.photos?.find(Boolean) || business.cover;

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 4000);
  }

  async function shareBusiness() {
    try {
      if (navigator.share)
        await navigator.share({
          title: business.name,
          text: `Agende seu horário no ${business.name}.`,
          url: window.location.href,
        });
      else {
        await navigator.clipboard.writeText(window.location.href);
        notify("Link copiado. Compartilhe com quem você quiser.");
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError"))
        notify("Copie o endereço do navegador para compartilhar.");
    }
  }

  const actions = [
    location && { href: location, label: "Localização", icon: MapPinIcon },
    whatsapp && { href: whatsapp, label: "WhatsApp", icon: WhatsAppIcon },
    instagram && { href: instagram, label: "Instagram", icon: InstagramIcon },
  ].filter(Boolean) as {
    href: string;
    label: string;
    icon: typeof WhatsAppIcon;
  }[];

  return (
    <div className="public-site pp" style={publicAccentStyle(business.color)}>
      <a className="public-skip-link" href="#servicos">
        Ir para os serviços
      </a>
      <PublicRefreshNotice error={error} refreshing={loading} retry={reload} />

      <header className="pp-cover">
        {business.cover ? (
          <PublicImage
            src={business.cover}
            alt=""
            className="pp-cover-photo"
            segment={business.category}
            priority
          />
        ) : (
          <div className="pp-cover-fallback" aria-hidden="true">
            <SegmentIcon
              category={business.category}
              size={220}
              weight="thin"
            />
          </div>
        )}
        <div className="pp-cover-shade" />
        <button
          className="pp-cover-share"
          aria-label="Compartilhar estabelecimento"
          onClick={shareBusiness}
        >
          <ShareNetwork size={19} weight="bold" />
        </button>
        <div className="pp-identity">
          {business.logo ? (
            <PublicImage
              src={business.logo}
              alt={`Logo do ${business.name}`}
              className="pp-logo"
              fallbackName={business.name}
            />
          ) : (
            <SegmentIcon
              category={business.category}
              className="pp-identity-icon"
              size={38}
              weight="light"
            />
          )}
          <h1>{business.name}</h1>
          <span>{business.category}</span>
        </div>
      </header>

      <div className="pp-layout">
        <main className="pp-main" id="conteudo">
          <section className="pp-sheet" aria-label="Sobre o estabelecimento">
            <div className="pp-status-row">
              <span className={`pp-status ${isOpen ? "is-open" : ""}`}>
                <i />
                {isOpen ? "Aberto agora" : "Fechado agora"}
              </span>
              {statusNote && (
                <span className="pp-status-note">{statusNote}</span>
              )}
            </div>
            {business.description && (
              <p className="pp-tagline">{business.description}</p>
            )}
            {actions.length > 0 && (
              <div
                className="pp-actions"
                style={{ "--cols": actions.length } as React.CSSProperties}
              >
                {actions.map(({ href, label, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="sf-press"
                  >
                    <Icon size={24} />
                    <span>{label}</span>
                  </a>
                ))}
              </div>
            )}
            <Link
              ref={mainCta}
              href={bookHref}
              className="public-button pp-cta sf-sheen"
            >
              Agendar horário <ArrowRight size={19} weight="bold" />
            </Link>
          </section>

          <PublicServices services={activeServices} slug={slug} />
          {ambiencePhoto && (
            <PublicAmbience
              photo={ambiencePhoto}
              businessName={business.name}
            />
          )}
          <PublicAmenities amenities={business.amenities} />
          <PublicTeam professionals={availableTeam} slug={slug} />
          <PublicVisit
            business={business}
            settings={settings}
            weekday={weekday}
            location={location}
          />
        </main>

        <aside className="pp-aside" aria-label="Agendamento online">
          <div className="pp-book-card">
            <span className={`pp-status ${isOpen ? "is-open" : ""}`}>
              <i />
              {isOpen ? "Aberto agora" : "Fechado agora"}
            </span>
            <h2>Agende em menos de um minuto</h2>
            <p>
              Escolha o serviço, o profissional e o melhor horário. Sem
              cadastro.
            </p>
            <dl>
              <div>
                <dt>
                  <Clock size={16} weight="duotone" /> Hoje
                </dt>
                <dd>
                  {openToday
                    ? `${settings.openStart} – ${settings.openEnd}`
                    : "Fechado"}
                </dd>
              </div>
              {business.address && (
                <div>
                  <dt>
                    <MapPin size={16} weight="duotone" /> Endereço
                  </dt>
                  <dd>{business.address}</dd>
                </div>
              )}
            </dl>
            <Link href={bookHref} className="public-button">
              Agendar horário <ArrowRight size={18} weight="bold" />
            </Link>
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="pp-book-help"
              >
                <WhatsAppIcon size={18} /> Falar no WhatsApp
              </a>
            )}
          </div>
        </aside>
      </div>

      <footer className="pp-footer">
        <span className="pp-powered">
          Agenda online por <BrandLogo size={18} /> <strong>StudioFlow</strong>
        </span>
        <Link href="/login">
          Acesso do estabelecimento <ArrowRight size={14} weight="bold" />
        </Link>
      </footer>

      <div
        className={`pp-dock ${showDock ? "is-visible" : ""}`}
        aria-hidden={!showDock}
      >
        <div>
          <strong>{business.name}</strong>
          <span>{isOpen ? "Aberto agora" : statusNote || "Agenda online"}</span>
        </div>
        <Link
          href={bookHref}
          className="public-button"
          tabIndex={showDock ? 0 : -1}
        >
          Agendar <ArrowRight size={17} weight="bold" />
        </Link>
      </div>
      {toast && (
        <div className="public-toast" role="status">
          <CheckCircle size={18} weight="fill" />
          {toast}
        </div>
      )}
    </div>
  );
}

function nextOpening(
  days: number[],
  weekday: number,
  time: string,
  start: string,
) {
  if (!days.length) return "";
  if (days.includes(weekday) && time < start) return `Abre hoje às ${start}`;
  for (let offset = 1; offset <= 7; offset++) {
    const day = (weekday + offset) % 7;
    if (days.includes(day))
      return offset === 1
        ? `Abre amanhã às ${start}`
        : `Abre ${shortDays[day]} às ${start}`;
  }
  return "";
}
