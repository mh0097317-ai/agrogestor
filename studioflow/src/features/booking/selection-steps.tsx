"use client";

import {
  CaretRight,
  Check,
  Clock,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import type { Service } from "@/types";
import type { PublicProfessional } from "@/features/public/types";
import { durationLabel, money } from "@/lib/utils";
import { PublicImage } from "@/features/public/public-ui";
import { usePublicData } from "@/features/public/use-public-catalog";
import type { Slot } from "@/types";
import { bookingDate, bookingTime } from "./date-format";

/** "hoje às 14:30", "amanhã às 09:00" or "sáb., 04/10 às 09:00". */
export function freeLabel(slot: Slot, now = new Date()) {
  const day = bookingDate(slot.start);
  const today = bookingDate(now);
  const tomorrow = bookingDate(new Date(now.getTime() + 86_400_000));
  const when =
    day === today
      ? "hoje"
      : day === tomorrow
        ? "amanhã"
        : new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
          }).format(new Date(slot.start));
  return `${when} às ${bookingTime(slot.start)}`;
}

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
      <h1 tabIndex={-1}>Qual serviço você deseja?</h1>
      <p className="booking-subtitle">
        O valor e o tempo aparecem em cada serviço.
      </p>
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
      <div className="booking-selection-list sf-stagger">
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
              {service.description && (
                <span className="booking-option-description">
                  {service.description}
                </span>
              )}
              <span className="booking-option-meta">
                <span>
                  <Clock weight="duotone" size={14} />
                  {durationLabel(service.duration)}
                </span>
                <b>{money(service.price)}</b>
              </span>
            </span>
            {selectedId === service.id ? (
              <span className="booking-check">
                <Check weight="bold" size={13} />
              </span>
            ) : (
              <CaretRight weight="bold" size={18} className="booking-muted" />
            )}
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
  slug,
  professionals,
  service,
  selectedId,
  onSelect,
}: {
  slug: string;
  professionals: PublicProfessional[];
  service: Service;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const available = professionals.filter(
    (person) => person.active && service.professionalIds.includes(person.id),
  );
  const { data: nextFree, loading } = usePublicData<Record<string, Slot>>(
    `/api/public/${encodeURIComponent(slug)}/next-free?serviceId=${service.id}`,
  );
  const earliest = Object.values(nextFree || {}).sort((a, b) =>
    a.start.localeCompare(b.start),
  )[0];
  const availability = (slot?: Slot) =>
    loading && !nextFree ? (
      <em className="booking-free is-loading">Consultando a agenda…</em>
    ) : slot ? (
      <em className="booking-free">
        <i /> Livre {freeLabel(slot)}
      </em>
    ) : nextFree ? (
      <em className="booking-free is-busy">Sem horários nos próximos dias</em>
    ) : null;
  return (
    <section className="booking-step">
      <h1 tabIndex={-1}>Quem vai te atender?</h1>
      <p className="booking-subtitle">
        Veja o próximo horário livre de cada profissional.
      </p>
      <div className="booking-selection-list sf-stagger">
        <button
          className={`booking-professional-option booking-any ${selectedId === "any" ? "is-selected" : ""}`}
          onClick={() => onSelect("any")}
          aria-pressed={selectedId === "any"}
        >
          <span className="booking-any-icon">
            <UsersThree weight="duotone" size={23} />
          </span>
          <span className="booking-option-info">
            <strong>Qualquer profissional</strong>
            <span>Quem estiver livre primeiro</span>
            {availability(earliest)}
          </span>
          {selectedId === "any" ? (
            <span className="booking-check">
              <Check weight="bold" size={13} />
            </span>
          ) : (
            <span className="booking-unchecked" />
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
              <span>
                {person.specialties.join(" · ") ||
                  `Realiza ${service.name.toLocaleLowerCase("pt-BR")}`}
              </span>
              {availability(nextFree?.[person.id])}
            </span>
            {selectedId === person.id ? (
              <span className="booking-check">
                <Check weight="bold" size={13} />
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
