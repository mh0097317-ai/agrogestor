"use client";

import Link from "next/link";
import { useState } from "react";
import { Scissors } from "@phosphor-icons/react/dist/ssr";
import type { Service } from "@/types";
import { durationLabel, money } from "@/lib/utils";
import { servicePhotos } from "@/lib/service-photos";
import { PhotoScrub } from "@/components/photo-scrub";
import { Lightbox } from "./public-gallery";

const shown = 8;
/** "R$ 45" for whole prices, "R$ 47,50" otherwise. */
const menuPrice = (value: number) =>
  Number.isInteger(value) ? `R$ ${value}` : money(value);

/** The service list as a printed menu: number, name, duration, price. */
export function PublicServices({
  services,
  slug,
  popularId,
}: {
  services: Service[];
  slug: string;
  popularId?: string | null;
}) {
  const visible = services.slice(0, shown);
  const [viewing, setViewing] = useState<{
    service: Service;
    index: number;
  } | null>(null);
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
          {visible.map((service, index) => {
            const photos = servicePhotos(service);
            return (
              <li
                key={service.id}
                data-reveal
                className={photos.length ? "has-photo" : undefined}
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
                    <strong>
                      {service.name}
                      {service.id === popularId && (
                        <em className="pp-popular">Mais pedido</em>
                      )}
                    </strong>
                    <small>{durationLabel(service.duration)}</small>
                  </span>
                  <span className="pp-menu-price">
                    {menuPrice(service.price)}
                  </span>
                </Link>
                {photos.length > 0 && (
                  <button
                    type="button"
                    className="pp-menu-photo"
                    aria-label={`Ver ${photos.length === 1 ? "a foto" : `as ${photos.length} fotos`} de ${service.name}`}
                    onClick={() => setViewing({ service, index: 0 })}
                  >
                    <PhotoScrub
                      photos={photos}
                      alt=""
                      className="pp-menu-scrub"
                    />
                    {photos.length > 1 && (
                      <span className="pp-menu-photo-count" aria-hidden="true">
                        {photos.length}
                      </span>
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="pp-empty">
          <Scissors size={26} weight="light" />
          <strong>Serviços em breve</strong>
          <p>Fale com o estabelecimento para saber mais.</p>
        </div>
      )}
      {viewing && (
        <Lightbox
          photos={servicePhotos(viewing.service)}
          index={viewing.index}
          onIndex={(index) => setViewing({ ...viewing, index })}
          onClose={() => setViewing(null)}
          businessName={viewing.service.name}
          bookHref={`/${slug}/agendar?service=${viewing.service.id}`}
          ctaLabel={`Agendar ${viewing.service.name}`}
        />
      )}
      {services.length > shown && (
        <Link href={`/${slug}/agendar`} className="pp-see-all">
          Ver todos os {services.length} serviços
        </Link>
      )}
    </section>
  );
}
