"use client";
import { useEffect, useState } from "react";
import {
  addDays,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Clock,
  LockKey,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import {
  PageHeader,
  Button,
  Card,
  DetailPanel,
  MetricStrip,
} from "@/components/ui";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/components/toast";
import { localDay, dateLabel, businessToday } from "@/lib/utils";
import type { Appointment, BlockedTime } from "@/types";
import { AppointmentForm } from "./appointment-form";
import { AppointmentDetail } from "./appointment-detail";
import { MobileDayAgenda } from "./mobile-day-agenda";
import { DayFocus } from "./day-focus";
import { DayTimeline } from "./day-timeline";
import { AgendaWeekStrip, WeekOverview, MonthOverview } from "./period-views";
import {
  appointmentsOn,
  validAgendaDate,
  type AgendaView,
} from "./agenda-helpers";

export function AgendaPage() {
  const { data, loading, error, refresh, mutate } = useWorkspace();
  const { canMutate } = usePermissions();
  const { toast } = useToast();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [view, setView] = useState<AgendaView>("day");
  const [date, setDate] = useState(businessToday);
  const [filter, setFilter] = useState("all");
  const [create, setCreate] = useState(false);
  const [initial, setInitial] = useState<{
    date?: string;
    time?: string;
    professionalId?: string;
    initialServiceId?: string;
  }>({});
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [block, setBlock] = useState<BlockedTime | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [releaseConfirm, setReleaseConfirm] = useState(false);
  useEffect(() => {
    function readQuery() {
      const query = new URLSearchParams(location.search);
      const nextView = query.get("view");
      queueMicrotask(() => {
        setView(nextView === "week" || nextView === "month" ? nextView : "day");
        setDate(validAgendaDate(query.get("date")) || businessToday());
        setFilter(query.get("professional") || "all");
      });
    }
    readQuery();
    window.addEventListener("popstate", readQuery);
    return () => window.removeEventListener("popstate", readQuery);
  }, []);
  const activeFilter = data?.professionals.some(
    (professional) => professional.id === filter,
  )
    ? filter
    : "all";
  function changeCalendar(next: {
    date?: Date;
    view?: AgendaView;
    filter?: string;
  }) {
    const nextDate = next.date || date;
    const nextView = next.view || view;
    const nextFilter = next.filter || activeFilter;
    setDate(nextDate);
    setView(nextView);
    setFilter(nextFilter);
    const query = new URLSearchParams(location.search);
    query.set("view", nextView);
    query.set("date", localDay(nextDate));
    if (nextFilter === "all") query.delete("professional");
    else query.set("professional", nextFilter);
    window.history.replaceState(
      null,
      "",
      `${location.pathname}?${query.toString()}`,
    );
  }
  if (loading && !data)
    return (
      <div className="screen-loader" aria-label="Carregando agenda">
        <div className="skeleton skeleton-title" />
        <div className="skeleton" style={{ height: 580 }} />
      </div>
    );
  if (!data)
    return (
      <div className="screen-error">
        <h2>Não conseguimos abrir a agenda</h2>
        <p>{error || "Confira sua conexão e tente novamente."}</p>
        <Button onClick={() => refresh()}>Tentar novamente</Button>
      </div>
    );
  const canEdit = canMutate("appointments");
  const appointments = data.appointments.filter(
    (appointment) =>
      !["cancelled", "no_show"].includes(appointment.status) &&
      (activeFilter === "all" || appointment.professionalId === activeFilter),
  );
  const selectedAppointments = appointmentsOn(appointments, localDay(date));
  const professionals = data.professionals.filter(
    (professional) =>
      (professional.active ||
        professional.id === activeFilter ||
        selectedAppointments.some(
          (appointment) => appointment.professionalId === professional.id,
        )) &&
      (activeFilter === "all" || professional.id === activeFilter),
  );
  const weekDays = eachDayOfInterval({
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  });
  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
  });
  const pending = selectedAppointments.filter(
    (appointment) => appointment.status === "pending",
  ).length;
  const inProgress = selectedAppointments.filter(
    (appointment) => appointment.status === "in_progress",
  ).length;
  function navigate(direction: number) {
    changeCalendar({
      date:
        view === "month"
          ? addMonths(date, direction)
          : addDays(date, direction * (view === "week" ? 7 : 1)),
    });
  }
  function add(day: Date, time = "09:00", professionalId?: string) {
    if (!canEdit) return;
    setInitial({
      date: localDay(day),
      time,
      professionalId:
        professionalId || (activeFilter === "all" ? undefined : activeFilter),
    });
    setCreate(true);
  }
  function openBlock(value: BlockedTime) {
    setBlock(value);
    setReleaseConfirm(false);
  }
  async function releaseBlock() {
    if (!block || !canMutate("blockedTimes")) return;
    setReleasing(true);
    try {
      await mutate("blockedTimes", "delete", { id: block.id });
      setBlock(null);
      toast("Horário liberado.");
    } catch (failure) {
      toast(
        failure instanceof Error
          ? failure.message
          : "Não foi possível liberar o horário.",
      );
    } finally {
      setReleasing(false);
    }
  }
  return (
    <div className="calendar-page">
      <PageHeader
        title="Agenda"
        description="Horários de toda a equipe por dia, semana ou mês."
        actions={
          canEdit ? (
            <Button onClick={() => add(date)}>
              <Plus size={17} /> Novo agendamento
            </Button>
          ) : undefined
        }
      />
      {error && (
        <div className="form-error" role="status">
          {error}{" "}
          <button type="button" onClick={() => refresh()}>
            Atualizar agenda
          </button>
        </div>
      )}
      <div className="calendar-toolbar">
        <div className="calendar-date-navigation">
          <button
            type="button"
            className="icon-button"
            onClick={() => navigate(-1)}
            aria-label="Período anterior"
          >
            <CaretLeft size={18} />
          </button>
          <strong>
            {view === "month"
              ? format(date, "MMMM yyyy", { locale: ptBR })
              : view === "week"
                ? `${format(weekDays[0], "dd")}–${format(weekDays[6], "dd 'de' MMMM", { locale: ptBR })}`
                : format(date, "dd 'de' MMMM", { locale: ptBR })}
          </strong>
          <button
            type="button"
            className="icon-button"
            onClick={() => navigate(1)}
            aria-label="Próximo período"
          >
            <CaretRight size={18} />
          </button>
          <Button
            variant="ghost"
            onClick={() => changeCalendar({ date: businessToday() })}
          >
            Hoje
          </Button>
        </div>
        <div className="calendar-view-controls">
          <select
            aria-label="Filtrar profissional"
            value={activeFilter}
            onChange={(event) => changeCalendar({ filter: event.target.value })}
          >
            <option value="all">Toda a equipe</option>
            {data.professionals.map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professional.name}
                {!professional.active ? " · inativo" : ""}
              </option>
            ))}
          </select>
          <div className="segmented" aria-label="Visualização da agenda">
            {(
              [
                ["day", "Dia"],
                ["week", "Semana"],
                ["month", "Mês"],
              ] as const
            ).map(([key, label]) => (
              <button
                type="button"
                key={key}
                aria-pressed={view === key}
                className={view === key ? "selected" : ""}
                onClick={() => changeCalendar({ view: key })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {view !== "month" && (
        <div className="calendar-mobile-dates">
          <AgendaWeekStrip
            days={weekDays}
            date={date}
            appointments={appointments}
            onSelect={(nextDate) => changeCalendar({ date: nextDate })}
          />
        </div>
      )}
      {view === "day" && (
        <DayFocus
          data={data}
          date={date}
          filter={activeFilter}
          appointments={selectedAppointments}
          now={now}
          canEdit={canEdit}
          onDetail={setDetail}
          onAdd={(day, time, professionalId, serviceId) => {
            if (!canEdit) return;
            setInitial({
              date: localDay(day),
              time,
              professionalId,
              initialServiceId: serviceId,
            });
            setCreate(true);
          }}
        />
      )}
      <Card className="calendar-main-card">
        <div className="calendar-card-heading">
          <div>
            <span className="calendar-eyebrow">
              {view === "week"
                ? "VISÃO DA SEMANA"
                : view === "month"
                  ? "VISÃO DO MÊS"
                  : "VISÃO DO DIA"}
            </span>
            <h2>
              {view === "day"
                ? format(date, "EEEE", { locale: ptBR })
                : view === "week"
                  ? "Seu tempo, em perspectiva."
                  : format(date, "MMMM", { locale: ptBR })}
            </h2>
          </div>
          <div className="calendar-legend">
            <span>
              <i /> Atendimento
            </span>
            <span>
              <i className="calendar-legend-break" /> Intervalo
            </span>
            <span>
              <i className="calendar-legend-block" /> Bloqueio
            </span>
          </div>
        </div>
        {view === "day" && (
          <div className="calendar-desktop-day">
            <DayTimeline
              data={data}
              date={date}
              professionals={professionals}
              appointments={selectedAppointments}
              canEdit={canEdit}
              onAdd={add}
              onDetail={setDetail}
              onBlock={openBlock}
            />
          </div>
        )}
        {view === "week" && (
          <div className="calendar-desktop-week">
            <WeekOverview
              data={data}
              days={weekDays}
              appointments={appointments}
              canEdit={canEdit}
              onAdd={add}
              onDetail={setDetail}
              onSelect={(nextDate) =>
                changeCalendar({ date: nextDate, view: "day" })
              }
            />
          </div>
        )}
        {view === "month" && (
          <MonthOverview
            days={monthDays}
            date={date}
            appointments={appointments}
            onSelect={(nextDate) => changeCalendar({ date: nextDate })}
          />
        )}
      </Card>
      <div
        className={`calendar-day-overview ${view === "month" ? "calendar-month-list" : ""}`}
      >
        <div className="calendar-selected-day">
          <div>
            <span className="calendar-eyebrow">
              {view === "month" ? "DIA SELECIONADO" : "ATENDIMENTOS DO DIA"}
            </span>
            <h2>{dateLabel(date, "EEEE, dd MMM")}</h2>
          </div>
          {view === "month" && (
            <Button
              variant="secondary"
              onClick={() => changeCalendar({ view: "day" })}
            >
              <CalendarBlank size={15} /> Abrir dia
            </Button>
          )}
        </div>
        <MetricStrip
          className="calendar-day-metrics"
          items={[
            { label: "Atendimentos", value: selectedAppointments.length },
            { label: "A confirmar", value: pending },
            { label: "Em andamento", value: inProgress },
          ]}
        />
        <MobileDayAgenda
          data={data}
          date={date}
          filter={activeFilter}
          appointments={selectedAppointments}
          canEdit={canEdit}
          alwaysVisible={view === "month"}
          onAdd={add}
          onDetail={setDetail}
          onBlock={openBlock}
        />
      </div>
      <footer className="calendar-footer">
        <span>
          <Clock size={14} /> Horário de Brasília
        </span>
        <span>
          {selectedAppointments.length} atendimentos em{" "}
          {dateLabel(date, "dd/MM")}
        </span>
      </footer>
      <AppointmentForm
        open={create}
        onClose={() => setCreate(false)}
        {...initial}
      />
      <AppointmentDetail appointment={detail} onClose={() => setDetail(null)} />
      <DetailPanel
        open={Boolean(block)}
        onClose={() => !releasing && setBlock(null)}
        title="Horário bloqueado"
        description="Um espaço reservado na agenda do profissional."
      >
        {block && (
          <div className="calendar-block-detail">
            <LockKey size={24} weight="duotone" />
            <h3>{block.reason}</h3>
            <p>
              {
                data.professionals.find(
                  (professional) => professional.id === block.professionalId,
                )?.name
              }
            </p>
            <dl>
              <div>
                <dt>Data</dt>
                <dd>{dateLabel(block.start, "dd 'de' MMMM")}</dd>
              </div>
              <div>
                <dt>Horário</dt>
                <dd>
                  {dateLabel(block.start, "HH:mm")}–
                  {dateLabel(block.end, "HH:mm")}
                </dd>
              </div>
            </dl>
            {canMutate("blockedTimes") &&
              (releaseConfirm ? (
                <div className="calendar-confirm-box">
                  <p>
                    Este período ficará disponível para novos atendimentos.
                    Deseja liberar?
                  </p>
                  <div className="form-actions">
                    <Button
                      variant="secondary"
                      onClick={() => setReleaseConfirm(false)}
                      disabled={releasing}
                    >
                      Manter bloqueio
                    </Button>
                    <Button onClick={releaseBlock} disabled={releasing}>
                      {releasing ? "Liberando…" : "Confirmar liberação"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setReleaseConfirm(true)}
                >
                  Liberar horário
                </Button>
              ))}
          </div>
        )}
      </DetailPanel>
    </div>
  );
}
