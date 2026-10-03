"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  Copy,
  Plus,
  Check,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToast } from "@/components/toast";
import { Avatar, Button, MetricStrip } from "@/components/ui";
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
export function Overview() {
  const { data, loading, error, refresh } = useWorkspace();
  const { toast } = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [date, setDate] = useState(businessToday);
  const [professional, setProfessional] = useState("all");
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
  const rows = model.appointments.filter(
    (a) => professional === "all" || a.professionalId === professional,
  );
  const nextProfessional = data.professionals.find(
    (p) => p.id === model.next?.professionalId,
  );
  const hours = Number(dateLabel(new Date(now), "HH"));
  const greeting =
    hours < 12 ? "Bom dia" : hours < 18 ? "Boa tarde" : "Boa noite";
  async function share() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/${data!.business.slug}`,
      );
      toast("Link da sua página copiado.");
    } catch {
      toast(`Sua página: ${location.origin}/${data!.business.slug}`);
    }
  }
  return (
    <div className="overview-page">
      <header className="overview-heading">
        <div>
          <div className="overview-eyebrow">
            <span className="overview-day-dot" /> {data.business.name}{" "}
            <span className="overview-demo">
              {data.mode === "demo" ? "Demonstração" : "Seu espaço"}
            </span>
          </div>
          <h1>
            {greeting}, {data.viewer?.name.split(" ")[0] || "bem-vindo"}
            <span>.</span>
          </h1>
          <p>
            {dateLabel(new Date(now), "EEEE, d 'de' MMMM")} <span>•</span> Seu
            dia, com tudo no lugar.
          </p>
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus size={17} /> Novo agendamento
        </Button>
      </header>
      <MetricStrip
        className="overview-metrics"
        items={[
          {
            label: today ? "Agendamentos hoje" : "Agendamentos no dia",
            value: model.appointments.length,
            detail: `${model.completed} concluídos`,
          },
          {
            label: "Receita prevista",
            value: money(model.revenue),
            detail: `${money(model.collected)} recebido`,
          },
          {
            label: "Horários disponíveis",
            value: model.freeSlots,
            detail: model.service
              ? `Para ${model.service.name}`
              : "Cadastre um serviço",
          },
          {
            label: "Novos clientes",
            value: model.newCustomers,
            detail: "Neste dia",
          },
        ]}
      />
      <div className="overview-body">
        <div className="overview-main">
          {model.next ? (
            <section className="next-appointment" aria-labelledby="next-title">
              <div className="next-appointment-heading">
                <span>
                  <span className="next-dot" />
                  {model.next.status === "in_progress"
                    ? "EM ATENDIMENTO"
                    : "PRÓXIMO ATENDIMENTO"}
                </span>
                <span>
                  {dateLabel(model.next.start, "HH:mm")} —{" "}
                  {dateLabel(model.next.end, "HH:mm")}
                </span>
              </div>
              <div className="next-appointment-content">
                <Avatar name={model.next.customerName} size={52} />
                <div>
                  <h2 id="next-title">{model.next.customerName}</h2>
                  <p>
                    {model.next.serviceIds
                      .map((id) => data.services.find((s) => s.id === id)?.name)
                      .join(" + ")}
                  </p>
                  <span>
                    {nextProfessional?.name} <span>•</span>{" "}
                    {money(model.next.price)}
                  </span>
                </div>
                <button
                  onClick={() => setDetail(model.next!)}
                  className="next-action"
                >
                  {model.next.status === "in_progress"
                    ? "Gerenciar atendimento"
                    : model.next.status === "pending"
                      ? "Revisar agendamento"
                      : "Ver atendimento"}
                  <ArrowRight size={17} />
                </button>
              </div>
            </section>
          ) : (
            <div className="next-empty">
              <Check size={22} />
              <div>
                <h2>
                  {today ? "Tudo em dia por aqui." : "Seu dia está livre."}
                </h2>
                <p>
                  {today
                    ? "Nenhum próximo atendimento previsto para hoje."
                    : "Adicione um agendamento para esta data."}
                </p>
              </div>
              <Button variant="secondary" onClick={() => setCreate(true)}>
                <Plus size={16} /> Agendar
              </Button>
            </div>
          )}
          <OverviewAgenda
            data={data}
            rows={rows}
            date={date}
            professional={professional}
            onProfessional={setProfessional}
            onDate={setDate}
            onSelect={setDetail}
          />
          <section className="overview-team">
            <div className="overview-section-title">
              <div>
                <span className="overview-eyebrow">QUEM FAZ ACONTECER</span>
                <h2>Sua equipe, em movimento.</h2>
              </div>
              <Link href="/dashboard/equipe">
                Ver equipe <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="overview-team-list">
              {data.professionals
                .filter((p) => p.active)
                .map((p) => (
                  <Link
                    href={`/dashboard/agenda?professional=${p.id}&date=${day}`}
                    key={p.id}
                  >
                    <Avatar name={p.name} src={p.photo} size={40} />
                    <div>
                      <strong>{p.name.split(" ")[0]}</strong>
                      <span>
                        {
                          model.appointments.filter(
                            (a) => a.professionalId === p.id,
                          ).length
                        }{" "}
                        atendimentos
                      </span>
                    </div>
                    <ArrowUpRight size={15} />
                  </Link>
                ))}
            </div>
          </section>
        </div>
        <aside className="overview-aside">
          <section className="overview-calendar">
            <span className="overview-eyebrow">UM OLHAR NA AGENDA</span>
            <MiniCalendar
              selected={date}
              onSelect={setDate}
              appointmentDays={data.appointments
                .filter((a) => a.status !== "cancelled")
                .map((a) => businessDay(a.start))}
            />
          </section>
          <section className="overview-day-summary">
            <div className="overview-section-title">
              <h2>Resumo do dia</h2>
              <Clock3 size={18} />
            </div>
            <dl>
              <div>
                <dt>Recebido</dt>
                <dd>{money(model.collected)}</dd>
              </div>
              <div>
                <dt>Ticket previsto</dt>
                <dd>{money(model.ticket)}</dd>
              </div>
              <div>
                <dt>Atendimentos concluídos</dt>
                <dd>
                  {model.completed} de {model.appointments.length}
                </dd>
              </div>
            </dl>
            <div className="overview-completion">
              <span
                style={{
                  width: `${model.appointments.length ? (model.completed / model.appointments.length) * 100 : 0}%`,
                }}
              />
            </div>
          </section>
          <section className="overview-pending">
            <span className="overview-eyebrow">MERECE SUA ATENÇÃO</span>
            <Link href={`/dashboard/agenda?date=${day}`}>
              <CalendarDays size={20} />
              <div>
                <strong>{model.pending.length} aguardando confirmação</strong>
                <span>Revise os horários do dia</span>
              </div>
              <ChevronRight size={16} />
            </Link>
            <Link href="/dashboard/clientes">
              <Users size={20} />
              <div>
                <strong>
                  {model.overdue.length} clientes na hora de voltar
                </strong>
                <span>Continue boas histórias</span>
              </div>
              <ChevronRight size={16} />
            </Link>
          </section>
          <section className="overview-share">
            <span className="overview-eyebrow">SEU ESPAÇO, SEMPRE ABERTO</span>
            <h2>
              O próximo cliente
              <br />
              começa com um link.
            </h2>
            <p>Compartilhe sua página e facilite o próximo agendamento.</p>
            <button onClick={share}>
              <Copy size={16} /> Copiar link público
              <ArrowUpRight size={16} />
            </button>
            <Link href={`/${data.business.slug}`}>
              Ver minha página <ArrowUpRight size={15} />
            </Link>
          </section>
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
export function MobileAppointment({
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
  return (
    <button className="mobile-appt" onClick={onClick}>
      <span className="mobile-appt-time">{dateLabel(a.start, "HH:mm")}</span>
      <Avatar name={a.customerName} size={36} />
      <div className="mobile-appt-info">
        <strong>{a.customerName}</strong>
        <p>
          {a.serviceIds
            .map((id) => data.services.find((s) => s.id === id)?.name)
            .join(" + ")}{" "}
          · {professional?.name.split(" ")[0]}
        </p>
      </div>
      <span className={`mobile-status-dot ${a.status}`} />
      <ChevronRight size={16} />
    </button>
  );
}
