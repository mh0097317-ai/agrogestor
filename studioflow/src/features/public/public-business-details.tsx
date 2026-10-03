import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Clock3,
  Coffee,
  MapPin,
  Snowflake,
  Wifi,
  Car,
} from "lucide-react";
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

export function PublicTeam({
  professionals,
  slug,
}: {
  professionals: PublicProfessional[];
  slug: string;
}) {
  return (
    <section id="equipe" className="public-section">
      <div className="public-section-heading">
        <div>
          <span className="public-eyebrow">
            02 / PESSOAS QUE CUIDAM DE VOCÊ
          </span>
          <h2>Nas melhores mãos.</h2>
        </div>
      </div>
      <div className="public-team-grid">
        {professionals.map((person) => (
          <Link
            href={`/${slug}/agendar?professional=${person.id}`}
            className="public-person-card"
            key={person.id}
          >
            <PublicImage
              src={person.photo}
              alt={person.name}
              className="public-person-photo"
              fallbackName={person.name}
            />
            <div>
              <h3>{person.name}</h3>
              <p>
                {person.specialties.join(" · ") ||
                  "Profissional do estabelecimento"}
              </p>
              <span>
                Agendar com {person.name.split(" ")[0]}{" "}
                <ArrowUpRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </div>
      {!professionals.length && (
        <p className="public-inline-empty">
          Nossa equipe está sendo preparada. Consulte os serviços disponíveis.
        </p>
      )}
    </section>
  );
}

export function PublicBusinessDetails({
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
    <section id="sobre" className="public-section public-about">
      <div className="public-section-heading">
        <div>
          <span className="public-eyebrow">03 / O NOSSO ESPAÇO</span>
          <h2>Chegue. Sinta-se em casa.</h2>
        </div>
      </div>
      <p>{business.description}</p>
      {photos.length > 0 && (
        <div className="public-photo-gallery">
          {photos.map((photo, index) => (
            <PublicImage
              src={photo}
              alt={`${business.name}: foto do espaço ${index + 1}`}
              className="public-gallery-photo"
              segment={business.category}
              key={`${photo}-${index}`}
            />
          ))}
        </div>
      )}
      {business.amenities.length > 0 && (
        <div className="public-amenities">
          {business.amenities.map((amenity) => {
            const Icon = /wi.fi/i.test(amenity)
              ? Wifi
              : /estacion/i.test(amenity)
                ? Car
                : /bebida|café/i.test(amenity)
                  ? Coffee
                  : /climat/i.test(amenity)
                    ? Snowflake
                    : Check;
            return (
              <div key={amenity}>
                <Icon size={19} />
                <span>{amenity}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="public-visit-grid">
        <div className="public-address">
          <span className="public-detail-icon">
            <MapPin size={23} />
          </span>
          <h3>Estamos aqui.</h3>
          <p>
            {business.address || "Consulte o endereço com o estabelecimento."}
          </p>
          {business.address && (
            <a
              className="public-text-link"
              href={location}
              target="_blank"
              rel="noreferrer"
            >
              Abrir localização <ArrowUpRight size={15} />
            </a>
          )}
        </div>
        <div className="public-hours">
          <h3>
            <Clock3 size={17} />
            Horário de funcionamento
          </h3>
          {weekDays.map((day, index) => (
            <div key={day} className={index === weekday ? "is-today" : ""}>
              <span>
                {day}
                {index === weekday && <small>Hoje</small>}
              </span>
              <strong>
                {settings.openDays.includes(index)
                  ? `${settings.openStart} – ${settings.openEnd}`
                  : "Fechado"}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
