"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  isSameMonth,
  isSameDay,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { localDay } from "@/lib/utils";
export function MiniCalendar({
  selected,
  onSelect,
  appointmentDays = [],
}: {
  selected: Date;
  onSelect: (day: Date) => void;
  appointmentDays?: string[];
}) {
  const [month, setMonth] = useState(startOfMonth(selected));
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });
  return (
    <>
      <div className="mini-calendar-head">
        <strong>{format(month, "MMMM yyyy", { locale: ptBR })}</strong>
        <div>
          <button
            className="icon-button"
            onClick={() => setMonth(addMonths(month, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="icon-button"
            onClick={() => setMonth(addMonths(month, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="calendar-weekdays">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="calendar-days">
        {days.map((day) => (
          <button
            key={day.toISOString()}
            aria-label={format(day, "d 'de' MMMM", { locale: ptBR })}
            aria-pressed={isSameDay(day, selected)}
            className={`${!isSameMonth(day, month) ? "outside" : ""} ${isSameDay(day, new Date()) ? "today" : ""} ${isSameDay(day, selected) ? "chosen" : ""} ${appointmentDays.includes(localDay(day)) ? "has-appt" : ""}`}
            onClick={() => onSelect(day)}
          >
            {format(day, "d")}
          </button>
        ))}
      </div>
      <div className="calendar-legend">
        <i /> Dias com agendamentos
      </div>
    </>
  );
}
