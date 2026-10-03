"use client";

import { Check, Clock, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { useState, type CSSProperties } from "react";
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

const stagger = (index: number) => ({ "--i": index }) as CSSProperties;

export function ServiceStep({
  services,
  selectedId,
  onSelect,
}: {
  services: Service[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const active = services.filter((service) => service.active);
  const [category, setCategory] = useState("Todos");
  const categories = ["Todos", ...new Set(active.map((s) => s.category))];
  const visible = active.filter(
    (service) => category === "Todos" || service.category === category,
  );
  return (
    <section className="bk-step">
      <header className="bk-step-head">
        <h1 tabIndex={-1}>Escolha o serviço</h1>
        <p>Toque em um serviço para seguir.</p>
      </header>
      {categories.length > 2 && (
        <div className="bk-tabs" role="group" aria-label="Categorias">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              className={category === item ? "is-active" : ""}
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
      <ul className="bk-services" role="list" key={category}>
        {visible.map((service, index) => {
          const selected = selectedId === service.id;
          return (
            <li key={service.id} style={stagger(index)}>
              <button
                type="button"
                className={`bk-service ${selected ? "is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onSelect(service.id)}
              >
                <PublicImage
                  src={service.image}
                  alt=""
                  className="bk-service-photo"
                  segment={service.category}
                />
                <span className="bk-service-body">
                  <strong>{service.name}</strong>
                  <span>
                    <Clock weight="bold" size={13} />
                    {durationLabel(service.duration)}
                  </span>
                </span>
                <span className="bk-service-price">{money(service.price)}</span>
                <span className="bk-check" aria-hidden="true">
                  <Check weight="bold" size={13} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && (
        <p className="bk-empty">Nenhum serviço disponível nesta categoria.</p>
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
      <em className="bk-free is-loading">Consultando agenda</em>
    ) : slot ? (
      <em className="bk-free">
        <i /> Livre {freeLabel(slot)}
      </em>
    ) : nextFree ? (
      <em className="bk-free is-busy">Agenda cheia nos próximos dias</em>
    ) : null;
  return (
    <section className="bk-step">
      <header className="bk-step-head">
        <h1 tabIndex={-1}>Com quem?</h1>
        <p>O próximo horário livre aparece em cada um.</p>
      </header>
      <ul className="bk-pros" role="list">
        {available.length > 1 && (
          <li style={stagger(0)}>
            <button
              type="button"
              className={`bk-pro is-any ${selectedId === "any" ? "is-selected" : ""}`}
              aria-pressed={selectedId === "any"}
              onClick={() => onSelect("any")}
            >
              <span className="bk-pro-stack" aria-hidden="true">
                {available.slice(0, 2).map((person) => (
                  <PublicImage
                    key={person.id}
                    src={person.photo}
                    alt=""
                    className="bk-pro-mini"
                    fallbackName={person.name}
                  />
                ))}
                <span className="bk-pro-spark">
                  <Sparkle weight="fill" size={14} />
                </span>
              </span>
              <span className="bk-pro-body">
                <strong>Sem preferência</strong>
                <span>Quem estiver livre primeiro</span>
                {availability(earliest)}
              </span>
              <span className="bk-check" aria-hidden="true">
                <Check weight="bold" size={13} />
              </span>
            </button>
          </li>
        )}
        {available.map((person, index) => (
          <li key={person.id} style={stagger(index + 1)}>
            <button
              type="button"
              className={`bk-pro ${selectedId === person.id ? "is-selected" : ""}`}
              aria-pressed={selectedId === person.id}
              onClick={() => onSelect(person.id)}
            >
              <PublicImage
                src={person.photo}
                alt=""
                className="bk-pro-photo"
                fallbackName={person.name}
              />
              <span className="bk-pro-body">
                <strong>{person.name}</strong>
                <span>
                  {person.specialties.slice(0, 2).join(" · ") || "Profissional"}
                </span>
                {availability(nextFree?.[person.id])}
              </span>
              <span className="bk-check" aria-hidden="true">
                <Check weight="bold" size={13} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {available.length === 0 && (
        <p className="bk-empty">
          Nenhum profissional atende este serviço no momento. Escolha outro
          serviço.
        </p>
      )}
    </section>
  );
}
