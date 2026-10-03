import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Car,
  CheckCircle,
  Coffee,
  Snowflake,
  WifiHigh,
} from "@phosphor-icons/react/dist/ssr";
import type { Business, Settings } from "@/types";
import type { PublicProfessional } from "./types";
import { PublicImage } from "./public-ui";

const weekDays = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function amenityIcon(amenity: string) {
  if (/wi.?fi/i.test(amenity)) return WifiHigh;
  if (/estacion/i.test(amenity)) return Car;
  if (/bebida|café|cafe/i.test(amenity)) return Coffee;
  if (/climat|ar.condicionado/i.test(amenity)) return Snowflake;
  return CheckCircle;
}

export function PublicAmbience({
  photo,
  businessName,
}: {
  photo: string;
  businessName: string;
}) {
  return (
    <a href="#espaco" className="pp-ambience" data-reveal="scale">
      <PublicImage src={photo} alt="" className="pp-ambience-photo" />
      <span className="pp-ambience-shade" />
      <span className="pp-ambience-text">
        <strong>Conheça o espaço</strong>
        <span>Fotos, horários e como chegar ao {businessName}.</span>
      </span>
      <ArrowRight size={20} weight="bold" className="pp-ambience-arrow" />
    </a>
  );
}

export function PublicAmenities({ amenities }: { amenities: string[] }) {
  if (!amenities.length) return null;
  return (
    <ul className="pp-amenities" aria-label="Comodidades" role="list">
      {amenities.map((amenity, index) => {
        const Icon = amenityIcon(amenity);
        return (
          <li
            key={amenity}
            data-reveal
            style={{ "--reveal-i": index } as React.CSSProperties}
          >
            <Icon size={24} weight="duotone" />
            <span>{amenity}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function PublicTeam({
  professionals,
  slug,
}: {
  professionals: PublicProfessional[];
  slug: string;
}) {
  if (!professionals.length) return null;
  return (
    <section id="equipe" className="pp-section">
      <div className="pp-section-head" data-reveal>
        <h2>Profissionais</h2>
      </div>
      <ul className="pp-team" role="list">
        {professionals.map((person, index) => (
          <li
            key={person.id}
            data-reveal
            style={{ "--reveal-i": index } as React.CSSProperties}
          >
            <Link
              href={`/${slug}/agendar?professional=${person.id}`}
              className="pp-person"
            >
              <PublicImage
                src={person.photo}
                alt=""
                className="pp-person-photo"
                fallbackName={person.name}
              />
              <strong>{person.name}</strong>
              <span>
                {person.specialties.slice(0, 2).join(" · ") || "Profissional"}
              </span>
              <em>
                Agendar <ArrowUpRight size={13} weight="bold" />
              </em>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PublicVisit({
  business,
  settings,
  weekday,
  location,
}: {
  business: Business;
  settings: Settings;
  weekday: number;
  location: string;
}) {
  const photos = (business.photos || []).filter(Boolean).slice(0, 4);
  return (
    <section id="espaco" className="pp-section">
      <div className="pp-section-head" data-reveal>
        <h2>O espaço</h2>
      </div>
      {photos.length > 0 && (
        <div
          className={`pp-gallery ${photos.length === 1 ? "is-single" : ""}`}
          data-reveal="scale"
        >
          {photos.map((photo, index) => (
            <PublicImage
              src={photo}
              alt={`${business.name}: foto do espaço ${index + 1}`}
              className="pp-gallery-photo"
              segment={business.category}
              key={`${photo}-${index}`}
            />
          ))}
        </div>
      )}
      <div className="pp-visit">
        <div className="pp-hours" data-reveal>
          <h3>Horário de funcionamento</h3>
          <dl>
            {weekDays.map((day, index) => (
              <div key={day} className={index === weekday ? "is-today" : ""}>
                <dt>
                  {day}
                  {index === weekday && <small>Hoje</small>}
                </dt>
                <dd>
                  {settings.openDays.includes(index)
                    ? `${settings.openStart} – ${settings.openEnd}`
                    : "Fechado"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {business.address && (
          <div className="pp-address" data-reveal>
            <h3>Como chegar</h3>
            <p>{business.address}</p>
            <iframe
              className="pp-map"
              title={`Mapa: ${business.address}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(business.address)}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a
              href={location}
              target="_blank"
              rel="noreferrer"
              className="public-text-link"
            >
              Abrir no mapa <ArrowUpRight size={15} weight="bold" />
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
