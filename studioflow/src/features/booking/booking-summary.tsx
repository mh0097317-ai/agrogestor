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
          Seu próximo momento de cuidado começa com a escolha do serviço.
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
        <ShieldCheck weight="duotone" size={15} /> Seus dados estão seguros
        conosco.
      </p>
    </div>
  );
}
