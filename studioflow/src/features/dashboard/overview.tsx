"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarCheck,
  CaretRight,
  CurrencyCircleDollar,
  Clock,
  Plus,
  UserPlus,
} from "@phosphor-icons/react/dist/ssr";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { Avatar, Button } from "@/components/ui";
import { MiniCalendar } from "@/components/mini-calendar";
import { CountUp } from "@/components/motion";
import { AppointmentForm } from "@/features/agenda/appointment-form";
import { AppointmentDetail } from "@/features/agenda/appointment-detail";
import {
  businessDay,
  businessToday,
  dateLabel,
  localDay,
  money,
} from "@/lib/utils";
import type { Appointment, Store } from "@/types";
import { overviewModel } from "./overview-model";
import { OverviewAgenda } from "./overview-agenda";
import { RemindersCard, WaitlistCard } from "./overview-growth";
import {
  AttentionCard,
  NowCard,
  OccupancyCard,
  ReviewsCard,
  WeekRevenueCard,
} from "./overview-widgets";

export function Overview() {
  const { data, loading, error, refresh } = useWorkspace();
  const { canMutate } = usePermissions();
  const [now, setNow] = useState(() => Date.now());
  const [date, setDate] = useState(businessToday);
  const [create, setCreate] = useState(false);
  const [detail, setDetail] = useState<Appointment | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  if (loading)
    return (
      <div className="overview-loading" aria-label="Carregando seu dia">
        <div className="skeleton skeleton-title" />
        <div className="skeleton" />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  if (error || !data)
    return (
      <div className="screen-error">
        <h2>Vamos reconectar seu espaço.</h2>
        <p>{error || "Os dados ainda não estão disponíveis."}</p>
        <Button onClick={() => void refresh()}>Tentar novamente</Button>
      </div>
    );
  const day = localDay(date);
  const today = day === businessDay(new Date(now));
  const model = overviewModel(data, day, now);
  const firstName = data.viewer?.name.split(" ")[0] || "bem-vindo";
  const hours = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  const clock = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  const greeting =
    hours < 12 ? "Bom dia" : hours < 18 ? "Boa tarde" : "Boa noite";
  const dayName = dateLabel(date, "d 'de' MMMM");
  const kpis = [
    {
      label: today ? "Agendamentos hoje" : "Agendamentos no dia",
      value: <CountUp value={model.appointments.length} />,
      icon: CalendarCheck,
    },
    {
      label: "Receita prevista",
      value: <CountUp value={model.revenue} format={money} />,
      icon: CurrencyCircleDollar,
    },
    {
      label: "Horários livres",
      value: <CountUp value={model.freeSlots} />,
      icon: Clock,
    },
    {
      label: "Novos clientes",
      value: <CountUp value={model.newCustomers} />,
      icon: UserPlus,
    },
  ];
  const nowCard = today ? model.next : undefined;
  const upcoming = model.upcoming
    .filter((a) => a.id !== nowCard?.id)
    .slice(0, 5);
  const canEdit = canMutate("appointments");

  return (
    <div className="ov">
      <section className="ov-hero" aria-label="Resumo de hoje">
        <div>
          <h1>Olá, {firstName}</h1>
          <p>
            {today ? "Hoje" : dateLabel(date, "EEEE")}, {dayName}
          </p>
        </div>
        <Link
          href={`/dashboard/agenda?date=${day}`}
          className="ov-hero-bell"
          aria-label={`${model.pending.length} agendamentos aguardando confirmação`}
        >
          <Bell size={21} weight="duotone" />
          {model.pending.length > 0 && <span>{model.pending.length}</span>}
        </Link>
      </section>

      <header className="ov-head">
        <div>
          <h1>
            {greeting}, {firstName}
          </h1>
          <p>
            {today
              ? "Aqui está o movimento de hoje."
              : `Aqui está o movimento de ${dayName}.`}
          </p>
        </div>
        <span className="ov-clock" aria-label="Horário de Brasília">
          <i />
          {clock.split(":")[0]}
          <b>:</b>
          {clock.split(":")[1]}
          <small>{dateLabel(new Date(now), "EEE, d MMM")}</small>
        </span>
      </header>

      <div className="ov-kpis sf-stagger">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div className="ov-kpi" key={label}>
            <span className="ov-kpi-icon">
              <Icon size={22} weight="duotone" />
            </span>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="ov-body">
        <div className="ov-main">
          {nowCard && (
            <NowCard
              appointment={nowCard}
              data={data}
              now={now}
              canEdit={canEdit}
              onOpen={setDetail}
            />
          )}
          <OverviewAgenda
            data={data}
            rows={model.appointments}
            date={date}
            onDate={setDate}
            onSelect={setDetail}
            canEdit={canEdit}
            now={now}
            onCreate={
              canMutate("appointments") ? () => setCreate(true) : undefined
            }
          />
          <div className="ov-insights">
            <WeekRevenueCard data={data} day={day} />
            <OccupancyCard data={data} day={day} />
          </div>
          <section className="ov-upcoming ov-card">
            <div className="ov-card-head">
              <h2>
                {today ? "Próximos agendamentos" : `Agenda de ${dayName}`}
              </h2>
              <Link href={`/dashboard/agenda?date=${day}`}>Ver todos</Link>
            </div>
            {upcoming.length ? (
              <ul role="list" className="sf-stagger">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    <UpcomingRow
                      appointment={a}
                      data={data}
                      onClick={() => setDetail(a)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="ov-empty">
                <p>
                  {today
                    ? "Nenhum próximo agendamento para hoje."
                    : "Nenhum agendamento nesta data."}
                </p>
                {canMutate("appointments") && (
                  <Button variant="secondary" onClick={() => setCreate(true)}>
                    <Plus size={16} weight="bold" /> Novo agendamento
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
        <aside className="ov-aside">
          <section className="ov-card ov-calendar" aria-label="Calendário">
            <MiniCalendar
              selected={date}
              onSelect={setDate}
              appointmentDays={data.appointments
                .filter((a) => a.status !== "cancelled")
                .map((a) => businessDay(a.start))}
            />
          </section>
          <section className="ov-card ov-summary">
            <h2>Resumo do dia</h2>
            <dl>
              <div>
                <dt>Receita prevista</dt>
                <dd>{money(model.revenue)}</dd>
              </div>
              <div>
                <dt>Receita realizada</dt>
                <dd>{money(model.collected)}</dd>
              </div>
              <div>
                <dt>Ticket médio</dt>
                <dd>{money(model.ticket)}</dd>
              </div>
              <div>
                <dt>Clientes atendidos</dt>
                <dd>{model.attended}</dd>
              </div>
              <div>
                <dt>Taxa de comparecimento</dt>
                <dd>
                  {model.attendanceRate === undefined
                    ? "—"
                    : `${Math.round(model.attendanceRate * 100)}%`}
                </dd>
              </div>
            </dl>
          </section>
          <AttentionCard
            data={data}
            now={now}
            canEdit={canEdit}
            onOpen={setDetail}
          />
          <RemindersCard data={data} now={now} />
          <WaitlistCard data={data} now={now} canEdit={canEdit} />
          <ReviewsCard data={data} />
        </aside>
      </div>
      <AppointmentForm
        open={create}
        onClose={() => setCreate(false)}
        date={day}
      />
      <AppointmentDetail appointment={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function UpcomingRow({
  appointment: a,
  data,
  onClick,
}: {
  appointment: Appointment;
  data: Store;
  onClick: () => void;
}) {
  const professional = data.professionals.find(
    (p) => p.id === a.professionalId,
  );
  const services = a.serviceIds
    .map((id) => data.services.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(" + ");
  return (
    <button className="ov-row" onClick={onClick}>
      <span className="ov-row-time">{dateLabel(a.start, "HH:mm")}</span>
      <Avatar name={a.customerName} size={36} />
      <span className="ov-row-info">
        <strong>{a.customerName}</strong>
        <span>
          {services}
          {professional && ` • ${professional.name.split(" ")[0]}`}
        </span>
      </span>
      {(a.status === "pending" || a.status === "in_progress") && (
        <span className={`ov-row-flag status-${a.status}`}>
          {a.status === "pending" ? "Aguardando" : "Agora"}
        </span>
      )}
      <CaretRight size={16} weight="bold" className="ov-row-chevron" />
    </button>
  );
}
