"use client";
import {
  ArrowUpRight,
  Clock,
  LockKey,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import { availableSlots } from "@/lib/availability";
import { businessDay, dateLabel, localDay, money } from "@/lib/utils";
import { Avatar, EmptyState, StatusBadge } from "@/components/ui";
import type { Store, Appointment, BlockedTime } from "@/types";
import { appointmentMinute, appointmentServices } from "./agenda-helpers";

export function MobileDayAgenda({
  data,
  date,
  filter,
  appointments,
  canEdit = true,
  alwaysVisible = false,
  onAdd,
  onDetail,
  onBlock,
}: {
  data: Store;
  date: Date;
  filter: string;
  appointments: Appointment[];
  canEdit?: boolean;
  alwaysVisible?: boolean;
  onAdd: (day: Date, time?: string, professionalId?: string) => void;
  onDetail: (appointment: Appointment) => void;
  onBlock?: (block: BlockedTime) => void;
}) {
  const service = data.services.find(
    (service) =>
      service.active &&
      (filter === "all" || service.professionalIds.includes(filter)),
  );
  const slots =
    service && canEdit
      ? availableSlots(
          data,
          [service.id],
          filter === "all" ? "any" : filter,
          localDay(date),
        )
      : [];
  const blocks = data.blockedTimes.filter(
    (block) =>
      (filter === "all" || block.professionalId === filter) &&
      businessDay(block.start) <= localDay(date) &&
      businessDay(block.end) >= localDay(date),
  );
  return (
    <div
      className={`calendar-day-list ${alwaysVisible ? "calendar-list-visible" : ""}`}
    >
      {appointments.length ? (
        ["Manhã", "Tarde", "Noite"].map((period, index) => {
          const entries = appointments
            .filter((appointment) => {
              const hour = appointmentMinute(appointment.start) / 60;
              return index === 0
                ? hour < 12
                : index === 1
                  ? hour >= 12 && hour < 18
                  : hour >= 18;
            })
            .sort((a, b) => a.start.localeCompare(b.start));
          return entries.length ? (
            <section className="calendar-list-period" key={period}>
              <header>
                <h2>{period}</h2>
                <span>
                  {entries.length}{" "}
                  {entries.length === 1 ? "atendimento" : "atendimentos"}
                </span>
              </header>
              {entries.map((appointment) => {
                const professional = data.professionals.find(
                  (professional) =>
                    professional.id === appointment.professionalId,
                );
                return (
                  <button
                    className={`calendar-list-appointment ${appointment.status === "in_progress" ? "calendar-list-current" : ""}`}
                    type="button"
                    key={appointment.id}
                    onClick={() => onDetail(appointment)}
                  >
                    <span className="calendar-list-time">
                      <strong>{dateLabel(appointment.start, "HH:mm")}</strong>
                      <small>{dateLabel(appointment.end, "HH:mm")}</small>
                    </span>
                    <div className="calendar-list-person">
                      <strong>{appointment.customerName}</strong>
                      <span>{appointmentServices(data, appointment)}</span>
                      <div>
                        <Avatar
                          name={professional?.name || "Profissional"}
                          src={professional?.photo}
                          size={20}
                        />
                        <small>
                          {professional?.name.split(" ")[0]} ·{" "}
                          {money(appointment.price)}
                        </small>
                      </div>
                      <StatusBadge status={appointment.status} />
                    </div>
                    <ArrowUpRight size={17} className="calendar-list-arrow" />
                  </button>
                );
              })}
            </section>
          ) : null;
        })
      ) : (
        <EmptyState
          title="Nenhum atendimento neste dia"
          description="Os próximos agendamentos desta data aparecerão aqui."
        />
      )}
      {blocks.length > 0 && (
        <section className="calendar-list-blocks">
          <header>
            <h2>Horários bloqueados</h2>
            <LockKey size={15} weight="duotone" />
          </header>
          {blocks.map((block) => (
            <button
              key={block.id}
              type="button"
              onClick={() => onBlock?.(block)}
            >
              <LockKey size={16} weight="duotone" />
              <div>
                <strong>{block.reason}</strong>
                <span>
                  {dateLabel(block.start, "HH:mm")}–
                  {dateLabel(block.end, "HH:mm")} ·{" "}
                  {
                    data.professionals
                      .find(
                        (professional) =>
                          professional.id === block.professionalId,
                      )
                      ?.name.split(" ")[0]
                  }
                </span>
              </div>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </section>
      )}
      {slots.length > 0 && (
        <section className="calendar-list-slots">
          <header>
            <h2>
              <Clock size={16} /> Janelas disponíveis
            </h2>
            <span>{service?.duration} min</span>
          </header>
          <p>
            Para {service?.name.toLowerCase()}. A disponibilidade será validada
            ao salvar.
          </p>
          <div>
            {slots.slice(0, 8).map((slot) => (
              <button
                type="button"
                key={slot.start}
                onClick={() => onAdd(date, slot.time, slot.professionalId)}
              >
                <Plus size={13} /> {slot.time}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
