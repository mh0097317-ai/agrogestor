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
  ArrowRight,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Lightning,
} from "@phosphor-icons/react/dist/ssr";
import { useMemo, useState, type CSSProperties } from "react";
import {
  timePeriods,
  matchesTimePeriod,
  type TimePeriod,
} from "@/lib/time-period";
import type { Settings, Slot } from "@/types";
import { usePublicData } from "@/features/public/use-public-catalog";
import type { PublicProfessional } from "@/features/public/types";
import { bookingDate, bookingTime } from "./date-format";
import { freeLabel, StepHead } from "./selection-steps";
import { WaitlistForm } from "./waitlist-form";

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
  embedded = false,
  waitlist = false,
  professionals,
}: {
  /** Names for the "first free time" shortcut. */
  professionals?: PublicProfessional[];
  slug: string;
  serviceId: string;
  professionalId: string;
  settings: Settings;
  selectedDate: string;
  selectedSlot?: Slot;
  onDate: (value: string) => void;
  onSlot: (value?: Slot) => void;
  /** Inside another screen (rescheduling): no step heading. */
  embedded?: boolean;
  /** Offer the waitlist on full days (new bookings only). */
  waitlist?: boolean;
}) {
  const [periodFilter, setPeriodFilter] = useState<TimePeriod>("all");
  const [showCalendar, setShowCalendar] = useState(false);
  const [monthStep, setMonthStep] = useState<"next" | "previous" | "">("");
  const [month, setMonthState] = useState(() =>
    startOfMonth(new Date(`${selectedDate || bookingDate()}T12:00:00`)),
  );
  function setMonth(next: Date) {
    setMonthStep(next > month ? "next" : "previous");
    setMonthState(next);
  }
  const today = startOfDay(new Date(`${bookingDate()}T12:00:00`));
  const todayKey = format(today, "yyyy-MM-dd");
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

  // Until the person picks a day, show the first day with free times so
  // the slots are visible right away.
  const firstAvailable = useMemo(
    () =>
      Object.keys(days)
        .sort()
        .find((day) => days[day].length > 0),
    [days],
  );
  const activeDate =
    (selectedDate && selectedDate.startsWith(monthKey) ? selectedDate : "") ||
    firstAvailable ||
    "";
  const availableSlots = days[activeDate] || [];
  const uniqueSlots = availableSlots.filter(
    (slot, index, list) =>
      list.findIndex((other) => other.time === slot.time) === index,
  );
  const periods = timePeriods;
  const quickDays = Object.keys(days)
    .sort()
    .filter((day) => days[day].length > 0)
    .slice(0, 7);

  /** Open day inside the booking window with every time taken. */
  function isFull(day: Date, key: string) {
    return (
      waitlist &&
      !loading &&
      !!data &&
      key > todayKey &&
      day <= maxDate &&
      settings.openDays.includes(day.getDay())
    );
  }
  const activeLabel = activeDate
    ? format(new Date(`${activeDate}T12:00:00`), "EEEE, d 'de' MMMM", {
        locale: ptBR,
      })
    : "";
  const waitlistForm = (full: boolean) =>
    waitlist && activeDate && activeDate > todayKey ? (
      <WaitlistForm
        key={`${activeDate}-${full}`}
        slug={slug}
        serviceId={serviceId.split(",")[0]}
        professionalId={professionalId}
        date={activeDate}
        dateLabel={activeLabel}
        full={full}
      />
    ) : null;
  function chooseDate(date: Date) {
    onDate(format(date, "yyyy-MM-dd"));
    onSlot(undefined);
    setShowCalendar(false);
  }
  const earliest = Object.keys(days)
    .sort()
    .flatMap((day) => days[day])
    .find((slot) => matchesTimePeriod(slot.time, periodFilter));
  const earliestWith =
    earliest && professionalId === "any"
      ? professionals
          ?.find((person) => person.id === earliest.professionalId)
          ?.name.split(" ")[0]
      : "";
  return (
    <section className="bk-step">
      {!embedded && (
        <StepHead
          title="Quando você deseja agendar?"
          text="Selecione a data e o horário disponível."
        />
      )}
      {!embedded && earliest && !selectedSlot && !loading && (
        <button
          type="button"
          className="bk-earliest"
          onClick={() => {
            onDate(firstAvailable!);
            onSlot(earliest);
          }}
        >
          <span className="bk-earliest-icon" aria-hidden="true">
            <Lightning weight="fill" size={16} />
          </span>
          <span className="bk-earliest-text">
            <small>Primeiro horário livre</small>
            <strong>
              {freeLabel(earliest)}
              {earliestWith ? ` com ${earliestWith}` : ""}
            </strong>
          </span>
          <ArrowRight weight="bold" size={18} />
        </button>
      )}
      <div className="bk-quick-dates" aria-label="Próximas datas disponíveis">
        <span className="bk-label">Escolha um dia</span>
        <div>
          {quickDays.map((day) => (
            <button
              type="button"
              key={day}
              aria-pressed={activeDate === day}
              onClick={() => chooseDate(new Date(day + "T12:00:00"))}
            >
              <small>
                {format(new Date(day + "T12:00:00"), "EEE", { locale: ptBR })}
              </small>
              <strong>{day.slice(-2)}</strong>
              <span>
                {format(new Date(day + "T12:00:00"), "MMM", { locale: ptBR })}
              </span>
            </button>
          ))}
        </div>
        <button
          className="bk-calendar-toggle"
          type="button"
          aria-expanded={showCalendar}
          onClick={() => setShowCalendar((value) => !value)}
        >
          <CalendarBlank size={16} />
          {showCalendar ? "Fechar calendário" : "Escolher outra data"}
        </button>
      </div>
      <div className="bk-schedule">
        <div className={`bk-calendar ${showCalendar ? "is-expanded" : ""}`}>
          <div className="bk-calendar-head">
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, -1))}
              disabled={monthKey <= format(today, "yyyy-MM")}
              aria-label="Mês anterior"
            >
              <CaretLeft weight="bold" size={18} />
            </button>
            <strong aria-live="polite">
              {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
            </strong>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              disabled={monthKey >= format(maxDate, "yyyy-MM")}
              aria-label="Próximo mês"
            >
              <CaretRight weight="bold" size={18} />
            </button>
          </div>
          <div
            key={monthKey}
            className={`bk-calendar-grid ${loading ? "is-loading" : ""} ${monthStep ? `is-${monthStep}` : ""}`}
          >
            {labels.map((label) => (
              <span key={label} className="bk-weekday">
                {label}
              </span>
            ))}
            {calendarDays.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const key = format(day, "yyyy-MM-dd");
              const available = !loading && (days[key]?.length || 0) > 0;
              const full = !available && isFull(day, key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!available && !full}
                  className={`${activeDate === key ? "is-selected" : ""} ${todayKey === key ? "is-today" : ""} ${available ? "is-open" : ""} ${full ? "is-full" : ""}`}
                  onClick={() => chooseDate(day)}
                  aria-pressed={activeDate === key}
                  aria-label={`${format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}${available ? ", com horários" : full ? ", lotado, lista de espera" : ", sem horários"}`}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
        {error ? (
          <div className="bk-alert" role="alert">
            <p>{error}</p>
            <button type="button" onClick={reload}>
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <div className="bk-times" aria-live="polite" aria-busy="true">
            <span className="bk-skeleton bk-skeleton-title" />
            <div className="bk-slot-grid">
              {Array.from({ length: 9 }).map((_, index) => (
                <span key={index} className="bk-skeleton bk-skeleton-slot" />
              ))}
            </div>
          </div>
        ) : activeDate ? (
          <div className="bk-times" key={activeDate}>
            <h2>
              {format(new Date(`${activeDate}T12:00:00`), "EEEE, d 'de' MMMM", {
                locale: ptBR,
              })}
            </h2>
            <div
              className="bk-period-filter"
              role="group"
              aria-label="Filtrar horários por período"
            >
              {[{ id: "all" as const, label: "Todos" }, ...periods].map(
                (period) => (
                  <button
                    type="button"
                    key={period.id}
                    aria-pressed={periodFilter === period.id}
                    onClick={() => {
                      setPeriodFilter(period.id);
                      if (
                        selectedSlot &&
                        !matchesTimePeriod(selectedSlot.time, period.id)
                      )
                        onSlot(undefined);
                    }}
                  >
                    {period.label}
                  </button>
                ),
              )}
            </div>
            {periodFilter !== "all" &&
              !uniqueSlots.some((slot) =>
                matchesTimePeriod(slot.time, periodFilter),
              ) && (
                <p className="bk-period-empty" role="status">
                  Não há horários neste período. Escolha outro período ou outra
                  data.
                </p>
              )}
            {periods
              .filter(
                (period) =>
                  periodFilter === "all" || periodFilter === period.id,
              )
              .map((period) => {
                const slots = uniqueSlots.filter((slot) =>
                  matchesTimePeriod(slot.time, period.id),
                );
                return (
                  slots.length > 0 && (
                    <div className="bk-period" key={period.label}>
                      <h3>{period.label}</h3>
                      <div className="bk-slot-grid">
                        {slots.map((slot, index) => (
                          <button
                            key={`${slot.time}-${slot.professionalId}`}
                            type="button"
                            style={{ "--i": index } as CSSProperties}
                            className={
                              selectedSlot?.start === slot.start
                                ? "is-selected"
                                : ""
                            }
                            aria-pressed={selectedSlot?.start === slot.start}
                            onClick={() => {
                              if (selectedDate !== activeDate)
                                onDate(activeDate);
                              onSlot(slot);
                            }}
                          >
                            <span>{slot.time}</span>
                            {selectedSlot?.start === slot.start && (
                              <small>até {bookingTime(slot.end)}</small>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                );
              })}
            {uniqueSlots.length === 0 &&
              (waitlistForm(true) || (
                <div className="bk-empty">
                  <CalendarBlank weight="duotone" size={24} />
                  <p>Esta data não tem horários livres. Escolha outro dia.</p>
                </div>
              ))}
            {uniqueSlots.length > 0 && waitlistForm(false)}
          </div>
        ) : (
          <div className="bk-empty">
            <CalendarBlank weight="duotone" size={24} />
            <p>
              Não há horários livres neste mês.{" "}
              {monthKey < format(maxDate, "yyyy-MM") && (
                <button
                  type="button"
                  onClick={() => setMonth(addMonths(month, 1))}
                >
                  Ver o próximo mês
                </button>
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
