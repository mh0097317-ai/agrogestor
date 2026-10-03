"use client";

import { Check, ChevronRight, Clock3, UsersRound } from "lucide-react";
import { useState } from "react";
import type { Service } from "@/types";
import type { PublicProfessional } from "@/features/public/types";
import { money } from "@/lib/utils";
import { PublicImage } from "@/features/public/public-ui";

export function ServiceStep({
  services,
  selectedId,
  onSelect,
}: {
  services: Service[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [category, setCategory] = useState("Todos");
  const categories = [
    "Todos",
    ...new Set(
      services
        .filter((service) => service.active)
        .map((service) => service.category),
    ),
  ];
  const visible = services.filter(
    (service) =>
      service.active && (category === "Todos" || service.category === category),
  );
  return (
    <section className="booking-step">
      <span className="public-eyebrow">01 / O QUE VAMOS FAZER?</span>
      <h1 tabIndex={-1}>Qual serviço você deseja?</h1>
      <p className="booking-subtitle">Escolha o serviço que deseja realizar.</p>
      <div
        className="booking-filter-tabs"
        role="group"
        aria-label="Categorias de serviço"
      >
        {categories.map((item) => (
          <button
            key={item}
            className={category === item ? "is-active" : ""}
            onClick={() => setCategory(item)}
            aria-pressed={category === item}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="booking-selection-list">
        {visible.map((service) => (
          <button
            className={`booking-service-option ${selectedId === service.id ? "is-selected" : ""}`}
            key={service.id}
            onClick={() => onSelect(service.id)}
            aria-pressed={selectedId === service.id}
          >
            <PublicImage
              src={service.image}
              alt={service.name}
              className="booking-service-image"
              segment={service.category}
            />
            <span className="booking-option-info">
              <strong>{service.name}</strong>
              <span>
                <Clock3 size={12} /> {service.duration} minutos
              </span>
            </span>
            <span className="booking-option-price">
              <b>{money(service.price)}</b>
              {selectedId === service.id ? (
                <span className="booking-check">
                  <Check size={13} />
                </span>
              ) : (
                <ChevronRight size={18} className="booking-muted" />
              )}
            </span>
          </button>
        ))}
      </div>
      {visible.length === 0 && (
        <div className="booking-empty">
          Nenhum serviço disponível nesta categoria.
        </div>
      )}
    </section>
  );
}

export function ProfessionalStep({
  professionals,
  service,
  selectedId,
  onSelect,
}: {
  professionals: PublicProfessional[];
  service: Service;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const available = professionals.filter(
    (person) => person.active && service.professionalIds.includes(person.id),
  );
  return (
    <section className="booking-step">
      <span className="public-eyebrow">02 / COM QUEM VOCÊ PREFERE?</span>
      <h1 tabIndex={-1}>Quem vai te atender?</h1>
      <p className="booking-subtitle">
        Escolha o profissional de sua preferência.
      </p>
      <div className="booking-selection-list">
        <button
          className={`booking-professional-option booking-any ${selectedId === "any" ? "is-selected" : ""}`}
          onClick={() => onSelect("any")}
          aria-pressed={selectedId === "any"}
        >
          <span className="booking-any-icon">
            <UsersRound size={23} />
          </span>
          <span className="booking-option-info">
            <strong>Qualquer profissional</strong>
            <span>Primeiro horário disponível</span>
          </span>
          {selectedId === "any" ? (
            <span className="booking-check">
              <Check size={13} />
            </span>
          ) : (
            <ChevronRight size={18} />
          )}
        </button>
        {available.map((person) => (
          <button
            className={`booking-professional-option ${selectedId === person.id ? "is-selected" : ""}`}
            key={person.id}
            onClick={() => onSelect(person.id)}
            aria-pressed={selectedId === person.id}
          >
            <PublicImage
              src={person.photo}
              alt={person.name}
              className="booking-professional-image"
              fallbackName={person.name}
            />
            <span className="booking-option-info">
              <strong>{person.name}</strong>
              <span>{person.specialties.join(" · ")}</span>
              <small>Realiza {service.name.toLocaleLowerCase("pt-BR")}</small>
            </span>
            {selectedId === person.id ? (
              <span className="booking-check">
                <Check size={13} />
              </span>
            ) : (
              <span className="booking-unchecked" />
            )}
          </button>
        ))}
      </div>
      {available.length === 0 && (
        <div className="booking-empty">
          Nenhum profissional atende este serviço no momento. Escolha outro
          serviço.
        </div>
      )}
    </section>
  );
}
