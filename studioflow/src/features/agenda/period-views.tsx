"use client";
import { format, isSameDay, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { dateLabel, localDay } from "@/lib/utils";
import type { Appointment, Store } from "@/types";
import { appointmentServices, appointmentsOn } from "./agenda-helpers";

export function AgendaWeekStrip({
  days,
  date,
  appointments,
  onSelect,
}: {
  days: Date[];
  date: Date;
  appointments: Appointment[];
  onSelect: (date: Date) => void;
}) {
  return (
    <nav className="calendar-week-strip" aria-label="Selecionar dia da semana">
      {days.map((day) => {
        const count = appointmentsOn(appointments, localDay(day)).length;
        return (
          <button
            type="button"
            key={localDay(day)}
            className={isSameDay(day, date) ? "selected" : ""}
            aria-pressed={isSameDay(day, date)}
            aria-label={`${dateLabel(day, "EEEE, dd 'de' MMMM")}, ${count} atendimentos`}
            onClick={() => onSelect(day)}
          >
            <span>{format(day, "EEE", { locale: ptBR }).replace(".", "")}</span>
            <strong>{format(day, "dd")}</strong>
            <i className={count ? "has-appointments" : ""} aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
export function WeekOverview({
  data,
  days,
  appointments,
  canEdit,
  onAdd,
  onSelect,
  onDetail,
}: {
  data: Store;
  days: Date[];
  appointments: Appointment[];
  canEdit: boolean;
  onAdd: (date: Date) => void;
  onSelect: (date: Date) => void;
  onDetail: (appointment: Appointment) => void;
}) {
  return (
    <div className="calendar-week-scroll">
      <div className="calendar-week-board">
        {days.map((day) => {
          const entries = appointmentsOn(appointments, localDay(day));
          return (
            <section className="calendar-week-column" key={localDay(day)}>
              <button
                className="calendar-week-heading"
                type="button"
                onClick={() => onSelect(day)}
                aria-label={`Abrir ${dateLabel(day)}`}
              >
                <span>{format(day, "EEE", { locale: ptBR })}</span>
                <strong>{format(day, "dd")}</strong>
                <small>
                  {entries.length} atendimentos <ArrowUpRight size={12} />
                </small>
              </button>
              <div className="calendar-week-events">
                {entries.map((appointment) => (
                  <button
                    className={`calendar-week-event calendar-status-${appointment.status}`}
                    type="button"
                    onClick={() => onDetail(appointment)}
                    key={appointment.id}
                  >
                    <span>
                      {dateLabel(appointment.start, "HH:mm")}–
                      {dateLabel(appointment.end, "HH:mm")}
                    </span>
                    <strong>{appointment.customerName}</strong>
                    <small>{appointmentServices(data, appointment)}</small>
                    <small>
                      {
                        data.professionals
                          .find(
                            (professional) =>
                              professional.id === appointment.professionalId,
                          )
                          ?.name.split(" ")[0]
                      }
                    </small>
                  </button>
                ))}
                {!entries.length && (
                  <p className="calendar-week-empty">Nenhum atendimento</p>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="calendar-week-add"
                  onClick={() => onAdd(day)}
                  aria-label={`Agendar em ${dateLabel(day)}`}
                >
                  <Plus size={15} /> Agendar
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
export function MonthOverview({
  days,
  date,
  appointments,
  onSelect,
}: {
  days: Date[];
  date: Date;
  appointments: Appointment[];
  onSelect: (date: Date) => void;
}) {
  return (
    <div className="calendar-month-board">
      <div className="calendar-month-weekdays">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-month-grid">
        {days.map((day) => {
          const entries = appointmentsOn(appointments, localDay(day));
          return (
            <button
              type="button"
              key={localDay(day)}
              className={`calendar-month-day ${!isSameMonth(day, date) ? "outside" : ""} ${isSameDay(day, date) ? "selected" : ""}`}
              aria-pressed={isSameDay(day, date)}
              aria-label={`${dateLabel(day, "dd 'de' MMMM")}, ${entries.length} atendimentos`}
              onClick={() => onSelect(day)}
            >
              <strong>{format(day, "d")}</strong>
              {entries.length > 0 && (
                <span className="calendar-month-count">
                  <b>{entries.length}</b>
                  <span>
                    {" "}
                    {entries.length === 1 ? "atendimento" : "atendimentos"}
                  </span>
                </span>
              )}
              <span className="calendar-month-dots" aria-hidden="true">
                {entries.slice(0, 3).map((appointment) => (
                  <i
                    key={appointment.id}
                    className={`calendar-status-${appointment.status}`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
