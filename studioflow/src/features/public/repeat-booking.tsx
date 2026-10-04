"use client";

import Link from "next/link";
import { ArrowsClockwise, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import type { Service } from "@/types";
import type { PublicProfessional } from "./types";
import { readLastBooking } from "@/lib/last-booking";

/** "Agendar de novo": repeats the last service and professional. */
export function RepeatBooking({
  slug,
  services,
  professionals,
  className = "",
}: {
  slug: string;
  services: Service[];
  professionals: PublicProfessional[];
  className?: string;
}) {
  // Rendered only after the catalog loads in the browser.
  const [last] = useState(() =>
    typeof window === "undefined" ? null : readLastBooking(slug),
  );
  const service = services.find(
    (item) => item.id === last?.serviceId && item.active,
  );
  if (!last || !service) return null;
  const person = professionals.find(
    (item) =>
      item.id === last.professionalId &&
      item.active &&
      service.professionalIds.includes(item.id),
  );
  const query = new URLSearchParams({ service: service.id });
  if (person) query.set("professional", person.id);
  return (
    <Link
      href={`/${slug}/agendar?${query}`}
      className={`repeat-booking ${className}`}
    >
      <span className="repeat-booking-icon" aria-hidden="true">
        <ArrowsClockwise size={18} weight="bold" />
      </span>
      <span className="repeat-booking-text">
        <small>Agendar de novo</small>
        <strong>
          {service.name}
          {person ? ` com ${person.name.split(" ")[0]}` : ""}
        </strong>
      </span>
      <CaretRight size={16} weight="bold" />
    </Link>
  );
}
