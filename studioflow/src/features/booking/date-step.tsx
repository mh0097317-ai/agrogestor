"use client";

import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CircleNotch,
} from "@phosphor-icons/react/dist/ssr";
import { useMemo, useState } from "react";
import type { Settings, Slot } from "@/types";
import { usePublicData } from "@/features/public/use-public-catalog";
import { bookingDate } from "./date-format";

type CalendarData = Record<string, Slot[]>;
const labels = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export function DateStep({
  slug,
  serviceId,
  professionalId,
  settings,
  selectedDate,
  selectedSlot,
  onDate,
  onSlot,
}: {
  slug: string;
  serviceId: string;
  professionalId: string;
  settings: Settings;
  selectedDate: string;
  selectedSlot?: Slot;
  onDate: (value: string) => void;
  onSlot: (value?: Slot) => void;
}) {
  const [month, setMonth] = useState(() =>
    startOfMonth(new Date(`${selectedDate || bookingDate()}T12:00:00`)),
  );
  const today = startOfDay(new Date(`${bookingDate()}T12:00:00`));
  const maxDate = addDays(today, settings.maxDays);
  const monthKey = format(month, "yyyy-MM");
  const calendarDays = useMemo(() => {
    const result: (Date | null)[] = Array.from(
      { length: month.getDay() },
      () => null,
    );
    for (let day = month; day <= endOfMonth(month); day = addDays(day, 1))
      result.push(day);
    return result;
  }, [month]);

  const query = new URLSearchParams({
    serviceId,
    professionalId,
    month: monthKey,
  });
  const { data, loading, error, reload } = usePublicData<
    { date: string; slots: Slot[] }[]
  >(`/api/public/${encodeURIComponent(slug)}/availability?${query}`);
  const days: CalendarData = useMemo(
    () => Object.fromEntries((data || []).map((day) => [day.date, day.slots])),
    [data],
  );

  const availableSlots = days[selectedDate] || [];
  const uniqueSlots = availableSlots.filter(
    (slot, index, list) =>
      list.findIndex((other) => other.time === slot.time) === index,
  );
  const periods = [
    { label: "Manhã", start: 0, end: 12 },
    { label: "Tarde", start: 12, end: 18 },
    { label: "Noite", start: 18, end: 24 },
  ];
  function chooseDate(date: Date) {
    onDate(format(date, "yyyy-MM-dd"));
    onSlot(undefined);
  }
  return (
    <section className="booking-step">
      <h1 tabIndex={-1}>Quando você deseja agendar?</h1>
      <p className="booking-subtitle">
        Selecione uma data e o horário disponível.
      </p>
      <div className="booking-scheduling-layout">
        <div className="booking-calendar">
          <div className="booking-calendar-heading">
            <button
              onClick={() => setMonth(addMonths(month, -1))}
              disabled={monthKey <= format(today, "yyyy-MM")}
              className="public-icon-button"
              aria-label="Mês anterior"
            >
              <CaretLeft weight="bold" size={18} />
            </button>
            <strong>{format(month, "MMMM 'de' yyyy", { locale: ptBR })}</strong>
            <button
              onClick={() => setMonth(addMonths(month, 1))}
              disabled={monthKey >= format(maxDate, "yyyy-MM")}
              className="public-icon-button"
              aria-label="Próximo mês"
            >
              <CaretRight weight="bold" size={18} />
            </button>
          </div>
          <div className="booking-calendar-grid">
            {labels.map((label) => (
              <span key={label} className="booking-weekday">
                {label}
              </span>
            ))}
            {calendarDays.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const key = format(day, "yyyy-MM-dd");
              const available = !loading && (days[key]?.length || 0) > 0;
              return (
                <button
                  key={key}
                  disabled={!available}
                  className={`${selectedDate === key ? "is-selected" : ""} ${format(today, "yyyy-MM-dd") === key ? "is-today" : ""}`}
                  onClick={() => chooseDate(day)}
                  aria-pressed={selectedDate === key}
                  aria-label={`${format(day, "d 'de' MMMM", { locale: ptBR })}${available ? ", com horários disponíveis" : ", indisponível"}`}
                >
                  {format(day, "d")}
                  {available && <i />}
                </button>
              );
            })}
          </div>
          <div className="booking-calendar-legend">
            <i /> Datas com horários disponíveis{" "}
            {loading && (
              <CircleNotch weight="bold" size={13} className="public-spin" />
            )}
          </div>
        </div>
        {error ? (
          <div className="booking-error" role="alert">
            <p>{error}</p>
            <button className="public-text-link" onClick={reload}>
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <div className="booking-slots-loading" aria-live="polite">
            <div className="public-skeleton public-skeleton-line" />
            <div className="booking-slot-grid">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="public-skeleton booking-slot-skeleton"
                />
              ))}
            </div>
          </div>
        ) : selectedDate ? (
          <div className="booking-times" key={selectedDate}>
            <h2>
              {format(
                new Date(`${selectedDate}T12:00:00`),
                "EEEE, d 'de' MMMM",
                {
                  locale: ptBR,
                },
              )}
            </h2>
            {periods.map((period) => {
              const slots = uniqueSlots.filter(
                (slot) =>
                  Number(slot.time.split(":")[0]) >= period.start &&
                  Number(slot.time.split(":")[0]) < period.end,
              );
              return (
                slots.length > 0 && (
                  <div className="booking-time-period" key={period.label}>
                    <h3>{period.label}</h3>
                    <div className="booking-slot-grid sf-stagger">
                      {slots.map((slot) => (
                        <button
                          key={`${slot.time}-${slot.professionalId}`}
                          className={
                            selectedSlot?.start === slot.start
                              ? "is-selected"
                              : ""
                          }
                          aria-pressed={selectedSlot?.start === slot.start}
                          onClick={() => onSlot(slot)}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              );
            })}
            {uniqueSlots.length === 0 && (
              <div className="booking-empty">
                <CalendarBlank weight="duotone" size={24} />
                <p>
                  Esta data não tem horários disponíveis. Escolha outro dia.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="booking-empty booking-date-hint">
            <CalendarBlank weight="duotone" size={22} />
            <p>
              {Object.values(days).some((slots) => slots.length)
                ? "Escolha uma data no calendário para ver os horários."
                : "Não há horários livres neste mês. Consulte o próximo mês."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
