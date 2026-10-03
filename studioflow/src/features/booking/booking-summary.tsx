"use client";

import {
  CalendarBlank,
  Clock,
  ShieldCheck,
  User,
} from "@phosphor-icons/react/dist/ssr";
import type { Service, Slot } from "@/types";
import type { PublicProfessional } from "@/features/public/types";
import { durationLabel, money } from "@/lib/utils";
import { PublicImage } from "@/features/public/public-ui";
import { bookingDateLabel, bookingTime } from "./date-format";

export function BookingSummary({
  service,
  professional,
  slot,
  compact = false,
  totalPrice,
}: {
  service?: Service;
  professional?: PublicProfessional;
  slot?: Slot;
  compact?: boolean;
  totalPrice?: number;
}) {
  return (
    <div className={`booking-summary ${compact ? "is-compact" : ""}`}>
      <span className="public-eyebrow">SEU AGENDAMENTO</span>
      {service ? (
        <div className="booking-summary-service">
          <PublicImage
            src={service.image}
            alt={service.name}
            className="booking-summary-photo"
          />
          <div>
            <h3>{service.name}</h3>
            <span>
              {durationLabel(service.duration)} ·{" "}
              {money(totalPrice ?? service.price)}
            </span>
          </div>
        </div>
      ) : (
        <p className="booking-summary-placeholder">
          Escolha um serviço para começar.
        </p>
      )}
      <dl>
        <div>
          <dt>
            <User weight="duotone" size={16} /> Profissional
          </dt>
          <dd>{professional?.name || "Primeiro disponível"}</dd>
        </div>
        <div>
          <dt>
            <CalendarBlank weight="duotone" size={16} /> Data
          </dt>
          <dd>{slot ? bookingDateLabel(slot.start, true) : "A escolher"}</dd>
        </div>
        <div>
          <dt>
            <Clock weight="duotone" size={16} /> Horário
          </dt>
          <dd>
            {slot
              ? `${bookingTime(slot.start)} – ${bookingTime(slot.end)}`
              : "A escolher"}
          </dd>
        </div>
      </dl>
      {service && (
        <div className="booking-summary-total">
          <span>Total</span>
          <strong>{money(totalPrice ?? service.price)}</strong>
        </div>
      )}
      <p className="booking-summary-safe">
        <ShieldCheck weight="duotone" size={15} /> Sem cadastro e sem senha.
      </p>
    </div>
  );
}

/** Boarding-pass style recap: service on top, when and who below. */
export function BookingTicket({
  service,
  professional,
  slot,
  totalPrice,
  onEdit,
}: {
  service: Service;
  professional?: PublicProfessional;
  slot: Slot;
  totalPrice?: number;
  onEdit?: (step: number) => void;
}) {
  return (
    <div className="bk-ticket">
      <div className="bk-ticket-top">
        <PublicImage
          src={service.image}
          alt=""
          className="bk-ticket-photo"
          segment={service.category}
        />
        <div>
          <strong>{service.name}</strong>
          <span>
            {durationLabel(service.duration)}
            {onEdit && (
              <button type="button" onClick={() => onEdit(1)}>
                Trocar
              </button>
            )}
          </span>
        </div>
        <b>{money(totalPrice ?? service.price)}</b>
      </div>
      <div className="bk-ticket-cut" aria-hidden="true" />
      <dl className="bk-ticket-rows">
        <div>
          <dt>
            <CalendarBlank weight="duotone" size={16} /> Quando
          </dt>
          <dd>
            <span className="bk-ticket-date">
              {bookingDateLabel(slot.start, true)}
            </span>
            <strong>
              {bookingTime(slot.start)} – {bookingTime(slot.end)}
            </strong>
          </dd>
          {onEdit && (
            <button type="button" onClick={() => onEdit(3)}>
              Alterar
            </button>
          )}
        </div>
        <div>
          <dt>
            <User weight="duotone" size={16} /> Com
          </dt>
          <dd>
            {professional && (
              <PublicImage
                src={professional.photo}
                alt=""
                className="bk-ticket-avatar"
                fallbackName={professional.name}
              />
            )}
            <strong>{professional?.name || "Primeiro disponível"}</strong>
          </dd>
          {onEdit && (
            <button type="button" onClick={() => onEdit(2)}>
              Alterar
            </button>
          )}
        </div>
      </dl>
    </div>
  );
}
