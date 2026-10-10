"use client";

import { useEffect, useState } from "react";
import { hasModule } from "@/lib/modules";
import { StudioFlowResults } from "./studioflow-results";
import "./experience.css";
import { OverviewWhatsApp } from "./overview-whatsapp";
import { PageChecklist } from "./page-checklist";
import { activationSteps } from "@/lib/activation";
import Link from "next/link";
import {
  CalendarCheck,
  CaretRight,
  CurrencyCircleDollar,
  Clock,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { Avatar, Button } from "@/components/ui";
import { MiniCalendar } from "@/components/mini-calendar";
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
      value: model.appointments.length,
      icon: CalendarCheck,
    },
    {
      label: "Recebido no dia",
      value: money(model.collected),
      icon: CurrencyCircleDollar,
    },
    {
      label: "Atendimentos concluídos",
      value: model.completed,
      icon: Clock,
    },
    {
      label: "Aguardando confirmação",
      value: model.pending.length,
      icon: CalendarCheck,
    },
  ];
  const nowCard = day >= businessDay(new Date(now)) ? model.next : undefined;
  const upcoming = model.upcoming
    .filter((a) => a.id !== nowCard?.id)
    .slice(0, 5);
  const canEdit = canMutate("appointments");

  return (
    <div className="ov">
      <section className="ov-command" aria-label="Seu dia no StudioFlow">
        <div className="ov-command-intro">
          <div className="ov-command-date">
            <span>{today ? "Seu dia, em foco" : "Sua agenda, em foco"}</span>
            <time>{dayName}</time>
          </div>
          <h1>
            {greeting},<br />
            <em>{firstName}.</em>
          </h1>
          <p>
            {today
              ? "Cuide de quem chega. O resto, a gente organiza."
              : "Um dia de cada vez. Tudo no seu lugar."}
          </p>
          <div className="ov-command-actions">
            {canEdit && (
              <Button onClick={() => setCreate(true)}>
                <Plus size={17} /> Novo agendamento
              </Button>
            )}
            <Link href={`/dashboard/agenda?date=${day}`}>
              Abrir agenda <CaretRight size={16} />
            </Link>
          </div>
          <span className="ov-command-foot">
            {data.professionals.filter((person) => person.active).length}{" "}
            profissionais na equipe <span>{clock} · Brasília</span>
          </span>
        </div>
        <div className="ov-command-focus">
          {data.business.cover && (
            <img
              className="ov-command-photo"
              src={data.business.cover}
              alt=""
            />
          )}
          {nowCard ? (
            <NowCard
              appointment={nowCard}
              data={data}
              now={now}
              canEdit={canEdit}
              onOpen={setDetail}
            />
          ) : (
            <div className="ov-command-empty">
              <span className="sf-eyebrow">
                <Clock size={17} />{" "}
                {day < businessDay(new Date(now))
                  ? "Resumo da data"
                  : "Próximo atendimento"}
              </span>
              <strong>
                {today ? (
                  <>
                    Um respiro
                    <br />
                    na agenda.
                  </>
                ) : day < businessDay(new Date(now)) ||
                  model.appointments.length > 0 ? (
                  <>
                    Agenda
                    <br />
                    conferida.
                  </>
                ) : (
                  <>
                    Seu dia está
                    <br />
                    em aberto.
                  </>
                )}
              </strong>
              <p>
                {today
                  ? "Nenhum próximo atendimento hoje. Aproveite para organizar o próximo dia."
                  : model.appointments.length > 0 ||
                      day < businessDay(new Date(now))
                    ? "Consulte os atendimentos e os detalhes desta data na agenda."
                    : "Crie o primeiro agendamento para esta data."}
              </p>
              <Link href={`/dashboard/agenda?date=${day}`}>
                Planejar agenda <CaretRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

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

      {hasModule(data.access?.modules, "recepcionista") && (
        <div className="ov-operating-grid">
          <OverviewWhatsApp data={data} />
          <StudioFlowResults data={data} now={now} />
        </div>
      )}
      <div className="ov-body">
        <div className="ov-main">
          {["owner", "admin", "manager"].includes(
            data.viewer?.role || "owner",
          ) && (
            <details className="ov-setup">
              <summary>Preparar meu espaço · configuração inicial</summary>
              <div
                className="ov-card"
                style={{ padding: 24, marginBottom: 16 }}
              >
                <h2>Da configuração à primeira reserva</h2>
                <p>
                  {activationSteps(data).filter((step) => step.ready).length} de
                  4 configurações conferidas. Complete a preparação e acompanhe
                  uma reserva de teste.
                </p>
                <Link
                  className="management-text-link"
                  href="/dashboard/ativacao"
                >
                  Abrir ativação guiada <CaretRight size={16} />
                </Link>
              </div>
              <PageChecklist data={data} />
            </details>
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
          <details className="ov-extra">
            <summary>Lembretes, lista de espera e avaliações</summary>
            <RemindersCard data={data} now={now} />
            <WaitlistCard data={data} now={now} canEdit={canEdit} />
            <ReviewsCard data={data} />
          </details>
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
