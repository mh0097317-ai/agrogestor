import Link from "next/link";
import { Scissors } from "@phosphor-icons/react/dist/ssr";
import type { Service } from "@/types";
import { durationLabel, money } from "@/lib/utils";

const shown = 8;
/** "R$ 45" for whole prices, "R$ 47,50" otherwise. */
const menuPrice = (value: number) =>
  Number.isInteger(value) ? `R$ ${value}` : money(value);

/** The service list as a printed menu: number, name, duration, price. */
export function PublicServices({
  services,
  slug,
}: {
  services: Service[];
  slug: string;
}) {
  const visible = services.slice(0, shown);
  return (
    <section id="servicos" className="pp-section">
      <div className="pp-section-head" data-reveal>
        <h2>Serviços</h2>
        {services.length > 0 && (
          <span className="pp-count">
            {services.length} {services.length === 1 ? "opção" : "opções"}
          </span>
        )}
      </div>
      {services.length ? (
        <ol className="pp-menu" role="list">
          {visible.map((service, index) => (
            <li
              key={service.id}
              data-reveal
              style={{ "--reveal-i": index } as React.CSSProperties}
            >
              <Link
                href={`/${slug}/agendar?service=${service.id}`}
                className="pp-menu-row"
                aria-label={`${service.name}, ${durationLabel(service.duration)}, ${money(service.price)}. Agendar`}
              >
                <span className="pp-menu-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="pp-menu-name">
                  <strong>{service.name}</strong>
                  <small>{durationLabel(service.duration)}</small>
                </span>
                <span className="pp-menu-price">
                  {menuPrice(service.price)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="pp-empty">
          <Scissors size={26} weight="light" />
          <strong>Serviços em breve</strong>
          <p>Fale com o estabelecimento para saber mais.</p>
        </div>
      )}
      {services.length > shown && (
        <Link href={`/${slug}/agendar`} className="pp-see-all">
          Ver todos os {services.length} serviços
        </Link>
      )}
    </section>
  );
}
