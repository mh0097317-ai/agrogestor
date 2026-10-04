"use client";

import { CalendarBlank, Clock, User } from "@phosphor-icons/react/dist/ssr";
import type { Service, Slot } from "@/types";
import type { PublicProfessional } from "@/features/public/types";
import { durationLabel, money } from "@/lib/utils";
import { PublicImage } from "@/features/public/public-ui";
import { bookingDateLabel, bookingTime } from "./date-format";

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** "Corte + Barba", total minutes and price of the chosen services. */
export function servicesSummary(services: Service[]) {
  return {
    name: services.map((service) => service.name).join(" + "),
    duration: services.reduce((sum, service) => sum + service.duration, 0),
    price: services.reduce((sum, service) => sum + service.price, 0),
  };
}

/** Services on top, then who, which day and what time. */
export function BookingRecap({
  services,
  professional,
  slot,
  totalPrice,
  onEdit,
}: {
  services: Service[];
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
  const summary = servicesSummary(services);
  const first = services[0];
  return (
    <div className="bk-recap">
      <div className="bk-recap-service">
        <span
          className={`bk-recap-photos ${services.length > 1 ? "is-stack" : ""}`}
        >
          {services.slice(0, 3).map((service) => (
            <PublicImage
              key={service.id}
              src={service.image}
              alt=""
              className="bk-recap-photo"
              segment={first?.category}
            />
          ))}
        </span>
        <div>
          <strong>{summary.name}</strong>
          <span>
            {durationLabel(summary.duration)} •{" "}
            {money(totalPrice ?? summary.price)}
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
