"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  ShareNetwork,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import { ratingLabel } from "@/lib/reviews";
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
import { PublicWork } from "./public-gallery";
import { RepeatBooking } from "./repeat-booking";
import {
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
              size={180}
              weight="thin"
            />
          </div>
        )}
        <button
          className="pp-cover-share"
          aria-label="Compartilhar estabelecimento"
          onClick={shareBusiness}
        >
          <ShareNetwork size={18} weight="bold" />
        </button>
        <span className={`pp-status ${isOpen ? "is-open" : ""}`}>
          <i />
          {isOpen
            ? `Aberto agora · fecha às ${settings.openEnd}`
            : statusNote || "Fechado agora"}
        </span>
      </header>

      <div className="pp-layout">
        <main className="pp-main" id="conteudo">
          <section className="pp-intro" aria-label="Sobre o estabelecimento">
            {business.logo && (
              <PublicImage
                src={business.logo}
                alt={`Logo do ${business.name}`}
                className="pp-logo"
                fallbackName={business.name}
              />
            )}
            <span className="pp-eyebrow">{business.category}</span>
            <h1>{business.name}</h1>
            {business.description && (
              <p className="pp-tagline">{business.description}</p>
            )}
            {catalog.rating && (
              <p
                className="pp-rating"
                aria-label={`Nota ${ratingLabel(catalog.rating)} de 5 em ${catalog.rating.count} ${catalog.rating.count === 1 ? "avaliação" : "avaliações"}`}
              >
                <Star size={14} weight="fill" />
                <strong>{ratingLabel(catalog.rating)}</strong>
                <span>
                  ({catalog.rating.count}{" "}
                  {catalog.rating.count === 1 ? "avaliação" : "avaliações"})
                </span>
              </p>
            )}
            <Link ref={mainCta} href={bookHref} className="pp-cta">
              Agendar horário <ArrowRight size={20} weight="regular" />
            </Link>
            {actions.length > 0 && (
              <nav className="pp-links" aria-label="Contato">
                {actions.map(({ href, label }) => (
                  <a key={label} href={href} target="_blank" rel="noreferrer">
                    {label}
                  </a>
                ))}
              </nav>
            )}
            <RepeatBooking
              slug={slug}
              services={activeServices}
              professionals={availableTeam}
            />
          </section>

          <PublicServices services={activeServices} slug={slug} />
          {settings.loyaltyEnabled && settings.loyaltyReward && (
            <section className="pp-section" aria-label="Cartão fidelidade">
              <Link href={bookHref} className="pp-loyalty" data-reveal>
                <span className="pp-loyalty-text">
                  <span className="pp-eyebrow">Cartão fidelidade</span>
                  <strong>
                    A cada {settings.loyaltyGoal} atendimentos,{" "}
                    <em>{settings.loyaltyReward}</em>.
                  </strong>
                </span>
                <span className="pp-loyalty-stamps" aria-hidden="true">
                  {Array.from(
                    { length: Math.min(settings.loyaltyGoal, 10) },
                    (_, index) => (
                      <i
                        key={index}
                        className={
                          index === Math.min(settings.loyaltyGoal, 10) - 1
                            ? "is-gift"
                            : ""
                        }
                      />
                    ),
                  )}
                </span>
              </Link>
            </section>
          )}
          <PublicWork
            photos={(business.photos ?? []).filter(Boolean)}
            businessName={business.name}
            bookHref={bookHref}
          />
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
            <span className="pp-eyebrow">Agenda online</span>
            <h2>Escolha o serviço, o profissional e o horário.</h2>
            <dl>
              <div>
                <dt>Hoje</dt>
                <dd>
                  {openToday
                    ? `${settings.openStart} – ${settings.openEnd}`
                    : "Fechado"}
                </dd>
              </div>
              {business.address && (
                <div>
                  <dt>Endereço</dt>
                  <dd>{business.address}</dd>
                </div>
              )}
            </dl>
            <Link href={bookHref} className="pp-cta">
              Agendar horário <ArrowRight size={20} weight="regular" />
            </Link>
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="pp-book-help"
              >
                <WhatsAppIcon size={17} /> Falar no WhatsApp
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
        <Link href={bookHref} className="pp-cta" tabIndex={showDock ? 0 : -1}>
          Agendar <ArrowRight size={18} weight="regular" />
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
