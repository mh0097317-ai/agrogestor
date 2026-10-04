"use client";

import {
  CaretRight,
  Check,
  Star,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { useState, type CSSProperties } from "react";
import type { Service } from "@/types";
import type { PublicProfessional, Rating } from "@/features/public/types";
import { durationLabel, money } from "@/lib/utils";
import { PublicImage } from "@/features/public/public-ui";
import { usePublicData } from "@/features/public/use-public-catalog";
import type { Slot } from "@/types";
import { bookingDate, bookingTime } from "./date-format";
import { ratingLabel } from "@/lib/reviews";

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

/** "★ 4,9 (120)": only real reviews, never a placeholder score. */
export function RatingLine({ rating }: { rating?: Rating }) {
  if (!rating?.count) return null;
  return (
    <span
      className="bk-rating"
      aria-label={`Nota ${ratingLabel(rating)} de 5, ${rating.count} ${rating.count === 1 ? "avaliação" : "avaliações"}`}
    >
      <Star weight="fill" size={14} />
      {ratingLabel(rating)} <em>({rating.count})</em>
    </span>
  );
}

const stagger = (index: number) => ({ "--i": index }) as CSSProperties;

function Indicator({
  selected,
  kind,
}: {
  selected: boolean;
  kind: "chevron" | "radio";
}) {
  return (
    <span
      className={`bk-indicator is-${kind} ${selected ? "is-on" : ""}`}
      aria-hidden="true"
    >
      {selected ? (
        <Check weight="bold" size={13} />
      ) : kind === "chevron" ? (
        <CaretRight weight="bold" size={16} />
      ) : null}
    </span>
  );
}

export function StepHead({ title, text }: { title: string; text: string }) {
  return (
    <header className="bk-head">
      <h1 tabIndex={-1}>{title}</h1>
      <p>{text}</p>
    </header>
  );
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
  const active = services.filter((service) => service.active);
  const [category, setCategory] = useState("Todos");
  const categories = ["Todos", ...new Set(active.map((s) => s.category))];
  const visible = active.filter(
    (service) => category === "Todos" || service.category === category,
  );
  return (
    <section className="bk-step">
      <StepHead
        title="Qual serviço você deseja?"
        text="Escolha o serviço que deseja realizar."
      />
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
      <ul className="bk-list" role="list" key={category}>
        {visible.map((service, index) => {
          const selected = selectedId === service.id;
          return (
            <li key={service.id} style={stagger(index)}>
              <button
                type="button"
                className={`bk-option ${selected ? "is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onSelect(service.id)}
              >
                <PublicImage
                  src={service.image}
                  alt=""
                  className="bk-option-photo"
                  segment={service.category}
                />
                <span className="bk-option-body">
                  <strong>{service.name}</strong>
                  <span>{durationLabel(service.duration)}</span>
                  <b>{money(service.price)}</b>
                </span>
                <Indicator selected={selected} kind="chevron" />
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
      <em className="bk-free is-loading">Consultando agenda…</em>
    ) : slot ? (
      <em className="bk-free">
        <i /> Livre {freeLabel(slot)}
      </em>
    ) : nextFree ? (
      <em className="bk-free is-busy">Sem horários nos próximos dias</em>
    ) : null;
  return (
    <section className="bk-step">
      <StepHead
        title="Quem vai te atender?"
        text="Escolha o profissional de sua preferência."
      />
      <ul className="bk-list" role="list">
        {available.length > 1 && (
          <li style={stagger(0)}>
            <button
              type="button"
              className={`bk-option is-any ${selectedId === "any" ? "is-selected" : ""}`}
              aria-pressed={selectedId === "any"}
              onClick={() => onSelect("any")}
            >
              <span className="bk-any-icon" aria-hidden="true">
                <UsersThree weight="duotone" size={24} />
              </span>
              <span className="bk-option-body">
                <strong>Qualquer profissional</strong>
                <span>Primeiro horário disponível</span>
                {availability(earliest)}
              </span>
              <Indicator selected={selectedId === "any"} kind="chevron" />
            </button>
          </li>
        )}
        {available.map((person, index) => (
          <li key={person.id} style={stagger(index + 1)}>
            <button
              type="button"
              className={`bk-option is-person ${selectedId === person.id ? "is-selected" : ""}`}
              aria-pressed={selectedId === person.id}
              onClick={() => onSelect(person.id)}
            >
              <PublicImage
                src={person.photo}
                alt=""
                className="bk-option-photo"
                fallbackName={person.name}
              />
              <span className="bk-option-body">
                <strong>{person.name}</strong>
                <RatingLine rating={person.rating} />
                <span>
                  {person.specialties.slice(0, 3).join(", ") || "Profissional"}
                </span>
                {availability(nextFree?.[person.id])}
              </span>
              <Indicator selected={selectedId === person.id} kind="radio" />
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
