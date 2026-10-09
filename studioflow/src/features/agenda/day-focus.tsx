"use client";
import { useState } from "react";
import {
  CalendarCheck,
  Clock,
  ArrowUpRight,
} from "@phosphor-icons/react/dist/ssr";
import { availableSlots } from "@/lib/availability";
import { businessDay, dateLabel, localDay } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";
import type { Appointment, Store } from "@/types";
import { ArrivedTag } from "./arrived-tag";

export function DayFocus({
  data,
  date,
  filter,
  appointments,
  now,
  canEdit,
  onDetail,
  onAdd,
}: {
  data: Store;
  date: Date;
  filter: string;
  appointments: Appointment[];
  now: number;
  canEdit: boolean;
  onDetail: (a: Appointment) => void;
  onAdd: (
    date: Date,
    time: string,
    professionalId: string,
    serviceId: string,
  ) => void;
}) {
  const [selectedService, setSelectedService] = useState("");
  const services = data.services.filter(
    (s) =>
      s.active &&
      s.professionalIds.some((id) =>
        data.professionals.some(
          (p) => p.id === id && p.active && (filter === "all" || filter === id),
        ),
      ),
  );
  const service =
    services.find((s) => s.id === selectedService) ||
    services.slice().sort((a, b) => a.duration - b.duration)[0];
  const slots = service
    ? availableSlots(
        data,
        [service.id],
        filter === "all" ? "any" : filter,
        localDay(date),
        new Date(now),
      )
    : [];
  const today = localDay(date) === businessDay(new Date(now));
  const next = appointments
    .filter(
      (a) =>
        ["confirmed", "pending", "in_progress"].includes(a.status) &&
        (!today || Date.parse(a.end) > now || a.status === "in_progress"),
    )
    .sort(
      (a, b) =>
        (a.status === "in_progress" ? 0 : 1) -
          (b.status === "in_progress" ? 0 : 1) ||
        a.start.localeCompare(b.start),
    )[0];
  return (
    <section
      className="calendar-focus"
      aria-label="Prioridades e disponibilidade do dia"
    >
      <div className="calendar-focus-next">
        <span className="calendar-focus-eyebrow">
          <CalendarCheck size={16} />{" "}
          {next?.status === "in_progress"
            ? "Em atendimento"
            : today
              ? "Próximo cliente"
              : "Primeiro atendimento do dia"}
        </span>
        {next ? (
          <button type="button" onClick={() => onDetail(next)}>
            <span className="calendar-focus-hour">
              {dateLabel(next.start, "HH:mm")}
            </span>
            <span>
              <strong>{next.customerName}</strong>
              <small>
                {
                  data.professionals.find((p) => p.id === next.professionalId)
                    ?.name
                }{" "}
                ·{" "}
                {next.serviceIds
                  .map((id) => data.services.find((s) => s.id === id)?.name)
                  .filter(Boolean)
                  .join(" + ")}
              </small>
              <StatusBadge status={next.status} />
              <ArrivedTag appointment={next} compact />
            </span>
            <ArrowUpRight size={20} />
          </button>
        ) : (
          <div className="calendar-focus-clear">
            <strong>
              {today
                ? "Sem próximos clientes hoje"
                : "Nenhum atendimento nesta data"}
            </strong>
            <small>
              Os horários da equipe continuam disponíveis na agenda.
            </small>
          </div>
        )}
      </div>
      <div className="calendar-focus-slots">
        <div className="calendar-focus-slots-head">
          <span className="calendar-focus-eyebrow">
            <Clock size={16} /> Janelas disponíveis
          </span>
          {service && (
            <select
              aria-label="Serviço para consultar janelas"
              value={service.id}
              onChange={(e) => setSelectedService(e.target.value)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.duration} min
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="calendar-focus-times">
          {slots.length ? (
            slots.slice(0, 5).map((slot) => (
              <button
                type="button"
                key={slot.start}
                disabled={!canEdit}
                onClick={() =>
                  onAdd(date, slot.time, slot.professionalId, service!.id)
                }
                title={
                  data.professionals.find((p) => p.id === slot.professionalId)
                    ?.name
                }
              >
                {slot.time}
                <ArrowUpRight size={13} />
              </button>
            ))
          ) : (
            <p>
              {service
                ? "Nenhuma janela disponível para este serviço."
                : "Cadastre um serviço e um profissional ativo para consultar horários."}
            </p>
          )}
        </div>
        <small>
          {slots.length
            ? `${slots.length} horários de início para ${service?.name}. `
            : ""}
          Disponibilidade conforme duração, intervalos e bloqueios. Validada
          novamente ao salvar.
        </small>
      </div>
    </section>
  );
}
