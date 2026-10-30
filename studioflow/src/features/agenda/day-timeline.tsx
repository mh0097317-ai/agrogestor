"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { Coffee, LockKey, Plus } from "@phosphor-icons/react/dist/ssr";
import { Avatar, EmptyState } from "@/components/ui";
import {
  businessDay,
  dateLabel,
  localDay,
  money,
  statusLabels,
} from "@/lib/utils";
import type { Appointment, Store, Professional, BlockedTime } from "@/types";
import {
  appointmentMinute,
  appointmentServices,
  minuteOf,
  timeOf,
  workingRange,
} from "./agenda-helpers";
import { freeWindows } from "./agenda-insights";
import { ArrivedTag } from "@/features/agenda/arrived-tag";

const open = (a: Appointment) =>
  a.status === "confirmed" || a.status === "pending";
const lengthLabel = (minutes: number) =>
  minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}` : ""}`;
/** The colour a booking takes on the board, beyond its status. */
function tone(a: Appointment) {
  if (open(a) && a.depositStatus === "pending") return "calendar-deposit";
  if (open(a) && a.checkedInAt) return "calendar-arrived";
  return "";
}

interface Drag {
  appointment: Appointment;
  x: number;
  y: number;
  from: number;
  duration: number;
  moved: boolean;
  minute: number;
  professionalId: string;
  valid: boolean;
}

export function DayTimeline({
  data,
  date,
  professionals,
  appointments,
  canEdit,
  onAdd,
  onDetail,
  onBlock,
  onMove,
  now,
}: {
  data: Store;
  date: Date;
  professionals: Professional[];
  appointments: Appointment[];
  canEdit: boolean;
  onAdd: (day: Date, time?: string, professionalId?: string) => void;
  onDetail: (appointment: Appointment) => void;
  onBlock: (block: BlockedTime) => void;
  /** Called when a booking is dropped on a free time, maybe in another column. */
  onMove?: (
    appointment: Appointment,
    start: string,
    professionalId: string,
  ) => void;
  now: number;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const pointer = useRef<Drag | null>(null);
  const dropped = useRef(false);
  const tracks = useRef(new Map<string, HTMLDivElement>());
  const scroller = useRef<HTMLDivElement>(null);
  const dayKey = localDay(date);
  // Today opens on the current time instead of the first hour.
  useEffect(() => {
    const element = scroller.current;
    const top = Number(element?.dataset.nowTop);
    if (element && Number.isFinite(top) && top > 0)
      element.scrollTop = Math.max(0, top - 160);
  }, [dayKey]);
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
  const currentMinute = appointmentMinute(new Date(now).toISOString());
  const showNow =
    businessDay(new Date(now)) === day &&
    currentMinute >= start &&
    currentMinute < end;
  const minutes = Array.from(
    { length: (end - start) / 30 },
    (_, index) => start + index * 30,
  );
  const today = businessDay(new Date(now));
  // Free windows are only worth showing for what is still ahead.
  const gapsFrom = day < today ? null : day === today ? currentMinute : 0;
  const canDrag = (a: Appointment) =>
    canEdit && !!onMove && open(a) && day >= today;
  /** Whether a booking fits at a minute in a column, as the server checks. */
  function fits(
    a: Appointment,
    minute: number,
    professionalId: string,
    duration: number,
  ) {
    const person = professionals.find((p) => p.id === professionalId);
    if (!person) return false;
    const range = workingRange(data, person, date);
    if (!range || minute < range.start || minute + duration > range.end)
      return false;
    if (day === today && minute < currentMinute) return false;
    if (
      !a.serviceIds.every((id) =>
        data.services
          .find((s) => s.id === id)
          ?.professionalIds.includes(professionalId),
      )
    )
      return false;
    const clash = (from: number, to: number) =>
      from < minute + duration && to > minute;
    if (
      person.breakStart &&
      person.breakEnd &&
      clash(minuteOf(person.breakStart), minuteOf(person.breakEnd))
    )
      return false;
    if (
      blocks.some(
        (b) =>
          b.professionalId === professionalId &&
          clash(blockBounds(b).start, blockBounds(b).end),
      )
    )
      return false;
    return !data.appointments.some(
      (other) =>
        other.id !== a.id &&
        other.professionalId === professionalId &&
        !["cancelled", "no_show"].includes(other.status) &&
        businessDay(other.start) === day &&
        clash(
          appointmentMinute(other.start) - data.settings.buffer,
          appointmentMinute(other.end) + data.settings.buffer,
        ),
    );
  }
  function grab(event: PointerEvent<HTMLButtonElement>, a: Appointment) {
    if (!canDrag(a) || event.button !== 0 || event.pointerType === "touch")
      return;
    const from = appointmentMinute(a.start);
    pointer.current = {
      appointment: a,
      x: event.clientX,
      y: event.clientY,
      from,
      duration: appointmentMinute(a.end) - from,
      moved: false,
      minute: from,
      professionalId: a.professionalId,
      valid: true,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function slide(event: PointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (!current) return;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(event.clientX - current.x, dy) < 6) return;
    const minute = Math.min(
      end - current.duration,
      Math.max(
        start,
        Math.round((current.from + dy / pixelsPerMinute) / 5) * 5,
      ),
    );
    let professionalId = current.professionalId;
    for (const [id, element] of tracks.current) {
      const rect = element.getBoundingClientRect();
      if (event.clientX >= rect.left && event.clientX < rect.right)
        professionalId = id;
    }
    const next = {
      ...current,
      moved: true,
      minute,
      professionalId,
      valid: fits(
        current.appointment,
        minute,
        professionalId,
        current.duration,
      ),
    };
    pointer.current = next;
    setDrag(next);
  }
  function drop() {
    const current = pointer.current;
    pointer.current = null;
    setDrag(null);
    if (!current?.moved) return;
    dropped.current = true;
    const a = current.appointment;
    if (
      !current.valid ||
      (current.minute === current.from &&
        current.professionalId === a.professionalId)
    )
      return;
    const target = new Date(a.start);
    target.setTime(target.getTime() + (current.minute - current.from) * 60000);
    onMove?.(a, target.toISOString(), current.professionalId);
  }
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
    <div
      className="calendar-timeline-scroll"
      ref={scroller}
      data-now-top={
        showNow ? (currentMinute - start) * pixelsPerMinute : undefined
      }
    >
      <div
        className="calendar-timeline"
        style={{ "--agenda-columns": professionals.length } as CSSProperties}
      >
        <div className="calendar-timeline-corner">
          <span>HORÁRIO</span>
        </div>
        {professionals.map((professional) => {
          const own = appointments.filter(
            (appointment) => appointment.professionalId === professional.id,
          );
          const count = own.length;
          const total = own.reduce((sum, a) => sum + a.price, 0);
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
                  {count} {count === 1 ? "horário" : "horários"}
                  {total > 0 && ` · ${money(total)}`}
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
          {showNow && (
            <span
              className="calendar-now-label"
              style={{ top: (currentMinute - start) * pixelsPerMinute }}
            >
              {timeOf(currentMinute)}
            </span>
          )}
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
              ref={(element) => {
                if (element) tracks.current.set(professional.id, element);
                else tracks.current.delete(professional.id);
              }}
              className={`calendar-person-track ${drag?.professionalId === professional.id ? "is-drop-target" : ""}`}
              style={{ height: (end - start) * pixelsPerMinute }}
            >
              {showNow && (
                <div
                  className="calendar-now-line"
                  style={{ top: (currentMinute - start) * pixelsPerMinute }}
                  aria-label={`Agora, ${timeOf(currentMinute)}`}
                />
              )}
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
                      <Coffee size={14} weight="duotone" />
                      <span>
                        Intervalo · {professional.breakStart}–
                        {professional.breakEnd}
                      </span>
                    </div>
                  )}
                </>
              )}
              {canEdit &&
                gapsFrom !== null &&
                freeWindows(data, professional, date, gapsFrom).map((gap) => (
                  <div
                    key={`gap-${gap.start}`}
                    className={`calendar-gap ${gap.end - gap.start < 35 ? "is-short" : ""}`}
                    style={position(gap.start, gap.end)}
                  >
                    <span>Livre · {lengthLabel(gap.end - gap.start)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        onAdd(date, timeOf(gap.start), professional.id)
                      }
                      aria-label={`Preencher o horário livre de ${professional.name} às ${timeOf(gap.start)}`}
                    >
                      <Plus size={13} weight="bold" /> Preencher
                    </button>
                  </div>
                ))}
              {drag?.professionalId === professional.id && (
                <div
                  className={`calendar-drag-ghost ${drag.valid ? "" : "is-invalid"}`}
                  style={position(drag.minute, drag.minute + drag.duration)}
                  aria-hidden="true"
                >
                  <strong>
                    {timeOf(drag.minute)}–{timeOf(drag.minute + drag.duration)}
                  </strong>
                  <span>
                    {drag.valid
                      ? `Soltar aqui · ${professional.name.split(" ")[0]}`
                      : "Horário ocupado"}
                  </span>
                </div>
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
                    <LockKey size={14} weight="duotone" />
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
                      className={`calendar-appointment calendar-status-${appointment.status} ${tone(appointment)} ${duration < 35 ? "calendar-short-event" : ""} ${canDrag(appointment) ? "is-draggable" : ""} ${drag?.appointment.id === appointment.id ? "is-dragging" : ""}`}
                      style={position(
                        appointmentMinute(appointment.start),
                        appointmentMinute(appointment.end),
                      )}
                      onPointerDown={(event) => grab(event, appointment)}
                      onPointerMove={slide}
                      onPointerUp={drop}
                      onPointerCancel={() => {
                        pointer.current = null;
                        setDrag(null);
                      }}
                      onClick={() => {
                        if (dropped.current) {
                          dropped.current = false;
                          return;
                        }
                        onDetail(appointment);
                      }}
                      aria-label={`${appointment.customerName}, ${appointmentServices(data, appointment)}, ${dateLabel(appointment.start, "HH:mm")} até ${dateLabel(appointment.end, "HH:mm")}, ${statusLabels[appointment.status]}`}
                    >
                      <span className="calendar-event-time">
                        {dateLabel(appointment.start, "HH:mm")}–
                        {dateLabel(appointment.end, "HH:mm")}
                        <i aria-hidden="true" />
                      </span>
                      <strong>{appointment.customerName}</strong>
                      <ArrivedTag appointment={appointment} compact />
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
