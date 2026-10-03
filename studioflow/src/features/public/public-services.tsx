import Link from "next/link";
import { CaretRight, Scissors } from "@phosphor-icons/react/dist/ssr";
import type { Service } from "@/types";
import { money } from "@/lib/utils";
import { PublicImage } from "./public-ui";

export function PublicServices({
  services,
  slug,
}: {
  services: Service[];
  slug: string;
}) {
  return (
    <section id="servicos" className="pp-section">
      <div className="pp-section-head" data-reveal>
        <h2>Nossos serviços</h2>
        {services.length > 0 && (
          <Link href={`/${slug}/agendar`} className="pp-see-all">
            Ver todos <CaretRight size={14} weight="bold" />
          </Link>
        )}
      </div>
      {services.length ? (
        <ul className="pp-services" role="list">
          {services.map((service, index) => (
            <li
              key={service.id}
              data-reveal
              style={{ "--reveal-i": index } as React.CSSProperties}
            >
              <Link
                href={`/${slug}/agendar?service=${service.id}`}
                className="pp-service"
                aria-label={`${service.name}, ${service.duration} minutos, ${money(service.price)}. Agendar`}
              >
                <PublicImage
                  src={service.image}
                  alt=""
                  className="pp-service-photo"
                  segment={service.category}
                />
                <strong>{service.name}</strong>
                <b>{money(service.price)}</b>
                <span>{service.duration} min</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="pp-empty">
          <Scissors size={26} weight="duotone" />
          <strong>Serviços em breve</strong>
          <p>Fale com o estabelecimento para saber mais.</p>
        </div>
      )}
    </section>
  );
}
