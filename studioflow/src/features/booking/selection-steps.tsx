"use client";

import { CaretRight, Star, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { Fragment, useState, type CSSProperties } from "react";
import type { Service } from "@/types";
import type { PublicProfessional, Rating } from "@/features/public/types";
import { durationLabel, money } from "@/lib/utils";
import { PublicImage } from "@/features/public/public-ui";
import { PhotoScrub } from "@/components/photo-scrub";
import { servicePhotos } from "@/lib/service-photos";
import { SegmentIcon } from "@/lib/segments";
import { RepeatBooking } from "@/features/public/repeat-booking";
import { DrawCheck } from "./draw-check";
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
  kind: "chevron" | "radio" | "check";
}) {
  return (
    <span
      className={`bk-indicator is-${kind} ${selected ? "is-on" : ""}`}
      aria-hidden="true"
    >
      {selected ? (
        <DrawCheck size={14} />
      ) : kind === "chevron" ? (
        <CaretRight weight="bold" size={16} />
      ) : null}
    </span>
  );
}

/** Step title: its words rise one after another. */
export function StepHead({ title, text }: { title: string; text: string }) {
  return (
    <header className="bk-head">
      <h1 tabIndex={-1} aria-label={title}>
        {title.split(" ").map((word, index) => (
          <Fragment key={`${word}-${index}`}>
            {index > 0 && " "}
            <span
              className="bk-word"
              aria-hidden="true"
              style={{ "--w": index } as CSSProperties}
            >
              <span>{word}</span>
            </span>
          </Fragment>
        ))}
      </h1>
      <p>{text}</p>
    </header>
  );
}

export function ServiceStep({
  services,
  selectedIds,
  onToggle,
  slug,
  professionals,
  popularId,
  notice,
}: {
  services: Service[];
  selectedIds: string[];
  /** `photo` is the row picture, used to fly the choice to the bar. */
  onToggle: (id: string, photo: HTMLElement | null) => void;
  slug?: string;
  professionals?: PublicProfessional[];
  /** Most booked service lately (real bookings), if any. */
  popularId?: string | null;
  /** Why the last choice could not be combined. */
  notice?: string;
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
        text="Pode escolher mais de um: o tempo e o valor somam."
      />
      {slug && professionals && (
        <RepeatBooking
          slug={slug}
          services={active}
          professionals={professionals}
          className="is-booking"
        />
      )}
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
              {item !== "Todos" &&
                active.some(
                  (service) =>
                    service.category === item &&
                    selectedIds.includes(service.id),
                ) && <i className="bk-tab-dot" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
      {notice && (
        <p className="bk-notice" role="status" key={notice}>
          {notice}
        </p>
      )}
      <ul className="bk-list" role="list" key={category}>
        {visible.map((service, index) => {
          const selected = selectedIds.includes(service.id);
          const order = selectedIds.indexOf(service.id) + 1;
          return (
            <li key={service.id} style={stagger(index)}>
              <button
                type="button"
                className={`bk-option ${selected ? "is-selected" : ""}`}
                aria-pressed={selected}
                onClick={(event) =>
                  onToggle(
                    service.id,
                    event.currentTarget.querySelector(".bk-option-photo"),
                  )
                }
              >
                <PhotoScrub
                  photos={servicePhotos(service)}
                  alt=""
                  label={`Fotos de ${service.name}`}
                  className="bk-option-photo"
                  fallback={
                    <span className="public-image-fallback">
                      <SegmentIcon category={service.category} size={28} weight="light" />
                    </span>
                  }
                />
                <span className="bk-option-body">
                  <strong>
                    {service.name}
                    {service.id === popularId && (
                      <em className="bk-popular">Mais pedido</em>
                    )}
                  </strong>
                  <span>{durationLabel(service.duration)}</span>
                  <b>{money(service.price)}</b>
                </span>
                <span className="bk-check-wrap">
                  <Indicator selected={selected} kind="check" />
                  {selected && selectedIds.length > 1 && (
                    <small className="bk-order" aria-hidden="true">
                      {order}º
                    </small>
                  )}
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
  services,
  selectedId,
  onSelect,
}: {
  slug: string;
  professionals: PublicProfessional[];
  services: Service[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const available = professionals.filter(
    (person) =>
      person.active &&
      services.every((service) => service.professionalIds.includes(person.id)),
  );
  const { data: nextFree, loading } = usePublicData<Record<string, Slot>>(
    `/api/public/${encodeURIComponent(slug)}/next-free?serviceId=${services.map((service) => service.id).join(",")}`,
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
