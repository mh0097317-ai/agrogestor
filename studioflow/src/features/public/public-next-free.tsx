"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Slot } from "@/types";
import type { PublicProfessional } from "./types";

const day = (value: Date | string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(value),
  );

const weekday = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  })
    .format(new Date(value))
    .replace("-feira", "");

function whenLabel(start: string) {
  const now = Date.now();
  if (day(start) === day(new Date(now))) return "Hoje";
  if (day(start) === day(new Date(now + 86_400_000))) return "Amanhã";
  return weekday(start).replace(/^./, (letter) => letter.toUpperCase());
}

/**
 * The earliest free time for the most booked service, live: a pulsing dot
 * when it is still today, one tap to open the booking on it.
 */
export function PublicNextFree({
  slug,
  serviceId,
  serviceName,
  professionals,
}: {
  slug: string;
  serviceId?: string;
  serviceName?: string;
  professionals: PublicProfessional[];
}) {
  const [next, setNext] = useState<(Slot & { when: string }) | null>(null);
  useEffect(() => {
    if (!serviceId) return;
    let alive = true;
    void fetch(
      `/api/public/${encodeURIComponent(slug)}/next-free?serviceId=${encodeURIComponent(serviceId)}`,
    )
      .then((response) => (response.ok ? response.json() : {}))
      .then((data: Record<string, Slot>) => {
        const first = Object.values(data || {}).sort((a, b) =>
          a.start.localeCompare(b.start),
        )[0];
        if (alive && first) setNext({ ...first, when: whenLabel(first.start) });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [slug, serviceId]);
  if (!next || !serviceId) return null;
  const { when } = next;
  const who = professionals
    .find((person) => person.id === next.professionalId)
    ?.name.split(" ")[0];
  return (
    <Link
      className={`pp-next ${when === "Hoje" ? "is-today" : ""}`}
      href={`/${slug}/agendar?service=${serviceId}&professional=${next.professionalId}`}
    >
      <i aria-hidden="true" />
      <span>
        <small>Próxima vaga{serviceName ? ` · ${serviceName}` : ""}</small>
        <strong>
          {when} às {next.time}
          {who ? ` com ${who}` : ""}
        </strong>
      </span>
      <b>Pegar</b>
    </Link>
  );
}
