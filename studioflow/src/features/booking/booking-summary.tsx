"use client";

import { CalendarBlank, Clock, User } from "@phosphor-icons/react/dist/ssr";
import type { Service, Slot } from "@/types";
import type { PublicProfessional } from "@/features/public/types";
import { durationLabel, money } from "@/lib/utils";
import { PublicImage } from "@/features/public/public-ui";
import { bookingDateLabel, bookingTime } from "./date-format";

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** Service on top, then who, which day and what time. */
export function BookingRecap({
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
  const rows = [
    {
      icon: <User weight="duotone" size={18} />,
      label: "Profissional",
      value: professional?.name || "Primeiro disponível",
      step: 2,
    },
    {
      icon: <CalendarBlank weight="duotone" size={18} />,
      label: "Data",
      value: capitalize(bookingDateLabel(slot.start, true)),
      step: 3,
    },
    {
      icon: <Clock weight="duotone" size={18} />,
      label: "Horário",
      value: `${bookingTime(slot.start)} – ${bookingTime(slot.end)}`,
      step: 3,
    },
  ];
  return (
    <div className="bk-recap">
      <div className="bk-recap-service">
        <PublicImage
          src={service.image}
          alt=""
          className="bk-recap-photo"
          segment={service.category}
        />
        <div>
          <strong>{service.name}</strong>
          <span>
            {durationLabel(service.duration)} •{" "}
            {money(totalPrice ?? service.price)}
          </span>
        </div>
        {onEdit && (
          <button type="button" onClick={() => onEdit(1)}>
            Trocar
          </button>
        )}
      </div>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <span className="bk-recap-icon">{row.icon}</span>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
            {onEdit && row.label !== "Horário" && (
              <button type="button" onClick={() => onEdit(row.step)}>
                Alterar
              </button>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
