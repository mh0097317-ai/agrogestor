"use client";
import type { CSSProperties } from "react";
import { Coffee, LockKeyhole, Plus } from "lucide-react";
import { Avatar, EmptyState } from "@/components/ui";
import { businessDay, dateLabel, localDay, statusLabels } from "@/lib/utils";
import type { Appointment, Store, Professional, BlockedTime } from "@/types";
import {
  appointmentMinute,
  appointmentServices,
  minuteOf,
  timeOf,
  workingRange,
} from "./agenda-helpers";

export function DayTimeline({
  data,
  date,
  professionals,
  appointments,
  canEdit,
  onAdd,
  onDetail,
  onBlock,
}: {
  data: Store;
  date: Date;
  professionals: Professional[];
  appointments: Appointment[];
  canEdit: boolean;
  onAdd: (day: Date, time?: string, professionalId?: string) => void;
  onDetail: (appointment: Appointment) => void;
  onBlock: (block: BlockedTime) => void;
}) {
  if (!professionals.length)
    return (
      <EmptyState
        title="Nenhum profissional disponível"
        description="Ative um profissional na equipe para organizar os atendimentos."
      />
    );
  const day = localDay(date);
  const shortestDuration = Math.min(
    20,
    ...appointments
      .map(
        (appointment) =>
          (new Date(appointment.end).getTime() -
            new Date(appointment.start).getTime()) /
          60000,
      )
      .filter((duration) => duration > 0),
  );
  const pixelsPerMinute = Math.max(2.4, 44 / shortestDuration);
  const blocks = data.blockedTimes.filter(
    (block) => businessDay(block.start) <= day && businessDay(block.end) >= day,
  );
  const bounds = [
    minuteOf(data.settings.openStart),
    minuteOf(data.settings.openEnd),
    ...professionals.flatMap((professional) => [
      minuteOf(professional.start),
      minuteOf(professional.end),
    ]),
    ...appointments.flatMap((appointment) => [
      appointmentMinute(appointment.start),
      appointmentMinute(appointment.end),
    ]),
    ...blocks.flatMap((block) => [
      businessDay(block.start) < day ? 0 : appointmentMinute(block.start),
      businessDay(block.end) > day ? 1440 : appointmentMinute(block.end),
    ]),
  ];
  const start = Math.floor(Math.min(...bounds) / 60) * 60;
  const end = Math.max(start + 60, Math.ceil(Math.max(...bounds) / 60) * 60);
  const minutes = Array.from(
    { length: (end - start) / 30 },
    (_, index) => start + index * 30,
  );
  const position = (from: number, to: number): CSSProperties => ({
    top: (Math.max(start, from) - start) * pixelsPerMinute,
    height:
      Math.max(0, Math.min(end, to) - Math.max(start, from)) * pixelsPerMinute,
  });
  const blockBounds = (block: BlockedTime) => ({
    start:
      businessDay(block.start) < day ? start : appointmentMinute(block.start),
    end: businessDay(block.end) > day ? end : appointmentMinute(block.end),
  });
  return (
    <div className="calendar-timeline-scroll">
      <div
        className="calendar-timeline"
        style={{ "--agenda-columns": professionals.length } as CSSProperties}
      >
        <div className="calendar-timeline-corner">
          <span>HORÁRIO</span>
        </div>
        {professionals.map((professional) => {
          const count = appointments.filter(
            (appointment) => appointment.professionalId === professional.id,
          ).length;
          return (
            <header className="calendar-person-heading" key={professional.id}>
              <Avatar
                name={professional.name}
                src={professional.photo}
                size={34}
              />
              <div>
                <strong>
                  {professional.name.split(" ").slice(0, 2).join(" ")}
                </strong>
                <span>
                  {count} {count === 1 ? "atendimento" : "atendimentos"}
                </span>
              </div>
            </header>
          );
        })}
        <div
          className="calendar-time-rail"
          style={{ height: (end - start) * pixelsPerMinute }}
        >
          {minutes.map((minute) => (
            <span
              key={minute}
              className={minute % 60 ? "calendar-half-hour" : ""}
              style={{ top: (minute - start) * pixelsPerMinute }}
            >
              {timeOf(minute)}
            </span>
          ))}
        </div>
        {professionals.map((professional) => {
          const range = workingRange(data, professional, date);
          const breakStart = professional.breakStart
            ? minuteOf(professional.breakStart)
            : 0;
          const breakEnd = professional.breakEnd
            ? minuteOf(professional.breakEnd)
            : 0;
          const entries = appointments.filter(
            (appointment) => appointment.professionalId === professional.id,
          );
          const personalBlocks = blocks.filter(
            (block) => block.professionalId === professional.id,
          );
          return (
            <div
              key={professional.id}
              className="calendar-person-track"
              style={{ height: (end - start) * pixelsPerMinute }}
            >
              {minutes.map((minute) => {
                const busy = entries.some(
                  (appointment) =>
                    appointmentMinute(appointment.start) < minute + 30 &&
                    appointmentMinute(appointment.end) + data.settings.buffer >
                      minute,
                );
                const blocked = personalBlocks.some((block) => {
                  const bounds = blockBounds(block);
                  return bounds.start < minute + 30 && bounds.end > minute;
                });
                const inBreak =
                  breakEnd > breakStart &&
                  breakStart < minute + 30 &&
                  breakEnd > minute;
                const available =
                  canEdit &&
                  range &&
                  minute >= range.start &&
                  minute < range.end &&
                  !busy &&
                  !blocked &&
                  !inBreak;
                return (
                  <button
                    type="button"
                    key={minute}
                    className="calendar-empty-slot"
                    style={position(minute, minute + 30)}
                    disabled={!available}
                    aria-label={`Criar atendimento com ${professional.name} às ${timeOf(minute)}`}
                    onClick={() => onAdd(date, timeOf(minute), professional.id)}
                  >
                    <Plus size={14} />
                    <span>{timeOf(minute)}</span>
                  </button>
                );
              })}
              {!range ? (
                <div
                  className="calendar-unavailable"
                  style={position(start, end)}
                >
                  <span>Folga</span>
                </div>
              ) : (
                <>
                  {range.start > start && (
                    <div
                      className="calendar-unavailable"
                      style={position(start, range.start)}
                    >
                      <span>Fora do expediente</span>
                    </div>
                  )}
                  {range.end < end && (
                    <div
                      className="calendar-unavailable"
                      style={position(range.end, end)}
                    >
                      <span>Fora do expediente</span>
                    </div>
                  )}
                  {breakEnd > breakStart && (
                    <div
                      className="calendar-break"
                      style={position(
                        Math.max(range.start, breakStart),
                        Math.min(range.end, breakEnd),
                      )}
                    >
                      <Coffee size={14} />
                      <span>
                        Intervalo · {professional.breakStart}–
                        {professional.breakEnd}
                      </span>
                    </div>
                  )}
                </>
              )}
              {personalBlocks.map((block) => {
                const bounds = blockBounds(block);
                return (
                  <button
                    key={block.id}
                    className="calendar-block"
                    style={position(bounds.start, bounds.end)}
                    onClick={() => onBlock(block)}
                    aria-label={`Bloqueio: ${block.reason}`}
                  >
                    <LockKeyhole size={14} />
                    <strong>{block.reason}</strong>
                    <span>
                      {dateLabel(block.start, "HH:mm")}–
                      {dateLabel(block.end, "HH:mm")}
                    </span>
                  </button>
                );
              })}
              {entries.map((appointment) => {
                const duration =
                  (new Date(appointment.end).getTime() -
                    new Date(appointment.start).getTime()) /
                  60000;
                return (
                  <div key={appointment.id} style={{ display: "contents" }}>
                    {data.settings.buffer > 0 && (
                      <div
                        className="calendar-service-buffer"
                        style={position(
                          appointmentMinute(appointment.end),
                          appointmentMinute(appointment.end) +
                            data.settings.buffer,
                        )}
                        aria-label={`${data.settings.buffer} minutos de preparação após o atendimento`}
                      />
                    )}
                    <button
                      key={appointment.id}
                      className={`calendar-appointment calendar-status-${appointment.status} ${duration < 35 ? "calendar-short-event" : ""}`}
                      style={position(
                        appointmentMinute(appointment.start),
                        appointmentMinute(appointment.end),
                      )}
                      onClick={() => onDetail(appointment)}
                      aria-label={`${appointment.customerName}, ${appointmentServices(data, appointment)}, ${dateLabel(appointment.start, "HH:mm")} até ${dateLabel(appointment.end, "HH:mm")}, ${statusLabels[appointment.status]}`}
                    >
                      <span className="calendar-event-time">
                        {dateLabel(appointment.start, "HH:mm")}–
                        {dateLabel(appointment.end, "HH:mm")}
                        <i aria-hidden="true" />
                      </span>
                      <strong>{appointment.customerName}</strong>
                      {duration >= 35 && (
                        <span className="calendar-event-service">
                          {appointmentServices(data, appointment)}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
