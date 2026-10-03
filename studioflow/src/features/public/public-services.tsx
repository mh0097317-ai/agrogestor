import Link from "next/link";
import { ChevronRight, Scissors } from "lucide-react";
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
      <div className="pp-section-head">
        <h2>Nossos serviços</h2>
        {services.length > 0 && (
          <Link href={`/${slug}/agendar`} className="pp-see-all">
            Ver todos <ChevronRight size={15} />
          </Link>
        )}
      </div>
      {services.length ? (
        <ul className="pp-services" role="list">
          {services.map((service) => (
            <li key={service.id}>
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
                <span>
                  {service.duration} min · {money(service.price)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="pp-empty">
          <Scissors size={22} />
          <strong>Serviços em breve</strong>
          <p>Fale com o estabelecimento para saber mais.</p>
        </div>
      )}
    </section>
  );
}
