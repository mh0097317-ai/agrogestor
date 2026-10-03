"use client";

import Link from "next/link";
import { ArrowUpRight, Clock3, Scissors } from "lucide-react";
import { useState } from "react";
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
  const [category, setCategory] = useState("Todos");
  const categories = [
    ...new Set(services.map((service) => service.category || "Serviços")),
  ];
  const visibleCategories =
    category === "Todos"
      ? categories
      : categories.filter((item) => item === category);
  return (
    <section id="servicos" className="public-section public-catalog">
      <div className="public-section-heading">
        <div>
          <span className="public-eyebrow">01 / ESCOLHA SEU CUIDADO</span>
          <h2>Serviços & experiências</h2>
        </div>
        <span className="public-section-count">{services.length} serviços</span>
      </div>
      {services.length ? (
        <>
          <div
            className="public-category-tabs"
            aria-label="Filtrar categoria de serviços"
          >
            {["Todos", ...categories].map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={category === item ? "is-active" : ""}
                aria-pressed={category === item}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="public-service-groups">
            {visibleCategories.map((item) => (
              <div className="public-service-group" key={item}>
                <h3 className="public-category-heading">
                  {item}
                  <span>
                    {services
                      .filter(
                        (service) => (service.category || "Serviços") === item,
                      )
                      .length.toString()
                      .padStart(2, "0")}
                  </span>
                </h3>
                <div className="public-services-list">
                  {services
                    .filter(
                      (service) => (service.category || "Serviços") === item,
                    )
                    .map((service) => (
                      <Link
                        key={service.id}
                        href={`/${slug}/agendar?service=${service.id}`}
                        className="public-service-card"
                      >
                        <PublicImage
                          src={service.image}
                          alt={service.name}
                          className="public-service-photo"
                          segment={service.category}
                        />
                        <div className="public-service-card-info">
                          <h4>{service.name}</h4>
                          {service.description && <p>{service.description}</p>}
                          <span>
                            <Clock3 size={13} />
                            {service.duration} minutos
                          </span>
                        </div>
                        <div className="public-service-price">
                          <strong>{money(service.price)}</strong>
                          <span>
                            Selecionar <ArrowUpRight size={14} />
                          </span>
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="public-inline-empty">
          <Scissors size={24} />
          <strong>Novos cuidados em breve</strong>
          <p>
            Estamos preparando nossos serviços. Entre em contato com o
            estabelecimento para saber mais.
          </p>
        </div>
      )}
    </section>
  );
}
