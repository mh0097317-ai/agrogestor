"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Play,
  SealCheck,
  Star,
  TrendDown,
  TrendUp,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import { CountUp } from "@/components/motion";
import { WhatsAppIcon } from "@/components/brand-icons";
import { dateLabel, money } from "@/lib/utils";
import type { Appointment, AppointmentStatus, Store } from "@/types";
import { attention, occupancy, weekRevenue } from "./insights";
import { ratingLabel, ratingSummary } from "@/lib/reviews";

/** The single next step for an appointment, if there is one. */
export function nextStep(status: AppointmentStatus) {
  if (status === "pending")
    return {
      status: "confirmed" as const,
      label: "Confirmar",
      Icon: SealCheck,
    };
  if (status === "confirmed")
    return { status: "in_progress" as const, label: "Iniciar", Icon: Play };
  if (status === "in_progress")
    return {
      status: "completed" as const,
      label: "Concluir",
      Icon: CheckCircle,
    };
  return null;
}

/** Runs a status change from anywhere on the home screen. */
export function useQuickStatus() {
  const { mutate } = useWorkspace();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState("");
  async function run(appointment: Appointment, status: AppointmentStatus) {
    setBusyId(appointment.id);
    try {
      await mutate("appointments", "update", { id: appointment.id, status });
      toast(
        status === "confirmed"
          ? `${appointment.customerName.split(" ")[0]} confirmado.`
          : status === "in_progress"
            ? "Atendimento iniciado."
            : "Atendimento concluído. Registre o pagamento no financeiro.",
      );
    } catch (failure) {
      toast(
        failure instanceof Error
          ? failure.message
          : "Não foi possível atualizar o atendimento.",
      );
    } finally {
      setBusyId("");
    }
  }
  return { run, busyId };
}

function whatsappLink(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return `https://wa.me/55${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function NowCard({
  appointment: a,
  data,
  now,
  canEdit,
  onOpen,
}: {
  appointment: Appointment;
  data: Store;
  now: number;
  canEdit: boolean;
  onOpen: (a: Appointment) => void;
}) {
  const { run, busyId } = useQuickStatus();
  const start = new Date(a.start).getTime();
  const end = new Date(a.end).getTime();
  const live = a.status === "in_progress";
  const progress = live
    ? Math.min(1, Math.max(0, (now - start) / (end - start)))
    : 0;
  const minutesTo = Math.round((start - now) / 60000);
  const professional = data.professionals.find(
    (p) => p.id === a.professionalId,
  );
  const services = a.serviceIds
    .map((id) => data.services.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(" + ");
  const step = nextStep(a.status);
  return (
    <section
      className={`ov-now ${live ? "is-live" : ""}`}
      aria-label="Atendimento atual"
    >
      <div className="ov-now-top">
        <span className="ov-now-tag">
          <i />
          {live
            ? "Na cadeira agora"
            : minutesTo > 0 && minutesTo <= 120
              ? `Próximo em ${minutesTo} min`
              : "Próximo atendimento"}
        </span>
        <span className="ov-now-time">
          {dateLabel(a.start, "HH:mm")} – {dateLabel(a.end, "HH:mm")}
        </span>
      </div>
      <button className="ov-now-body" onClick={() => onOpen(a)}>
        <Avatar name={a.customerName} size={52} />
        <span className="ov-now-info">
          <strong>{a.customerName}</strong>
          <span>
            {services}
            {professional && ` · com ${professional.name.split(" ")[0]}`}
          </span>
        </span>
        <b>{money(a.price)}</b>
      </button>
      {live && (
        <div
          className="ov-now-progress"
          role="progressbar"
          aria-label="Andamento do atendimento"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <div className="ov-now-actions">
        {canEdit && step && (
          <button
            className="ov-now-primary sf-press"
            disabled={busyId === a.id}
            onClick={() => void run(a, step.status)}
          >
            <step.Icon size={18} weight="bold" />
            {busyId === a.id ? "Salvando…" : `${step.label} atendimento`}
          </button>
        )}
        <a
          className="ov-now-secondary sf-press"
          href={whatsappLink(a.customerPhone)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Chamar ${a.customerName} no WhatsApp`}
        >
          <WhatsAppIcon size={20} />
        </a>
      </div>
    </section>
  );
}

export function WeekRevenueCard({ data, day }: { data: Store; day: string }) {
  const week = weekRevenue(data, day);
  const max = Math.max(
    1,
    ...week.rows.map((r) => Math.max(r.received, r.expected)),
  );
  return (
    <section className="ov-card ov-week" aria-labelledby="ov-week-title">
      <div className="ov-card-head">
        <h2 id="ov-week-title">Últimos 7 dias</h2>
        {week.change !== undefined && (
          <span
            className={`ov-trend ${week.change >= 0 ? "is-up" : "is-down"}`}
          >
            {week.change >= 0 ? (
              <TrendUp size={14} weight="bold" />
            ) : (
              <TrendDown size={14} weight="bold" />
            )}
            {Math.abs(Math.round(week.change * 100))}% vs semana anterior
          </span>
        )}
      </div>
      <strong className="ov-week-total">
        <CountUp value={week.total} format={money} />
      </strong>
      <span className="ov-week-caption">recebidos na semana</span>
      <div
        className="ov-bars"
        role="img"
        aria-label="Recebido por dia na semana"
      >
        {week.rows.map((row, index) => (
          <div
            key={row.date}
            className={`ov-bar ${row.date === day ? "is-today" : ""}`}
            title={`${dateLabel(row.date, "EEEE, dd/MM")}: ${money(row.received)}`}
          >
            <span className="ov-bar-track">
              <span
                className="ov-bar-expected"
                style={{ height: `${(row.expected / max) * 100}%` }}
              />
              <span
                className="ov-bar-fill"
                style={{
                  height: `${(row.received / max) * 100}%`,
                  animationDelay: `${index * 60}ms`,
                }}
              />
            </span>
            <small>{row.label}</small>
          </div>
        ))}
      </div>
      <div className="ov-legend">
        <span>
          <i className="is-received" /> Recebido
        </span>
        <span>
          <i className="is-expected" /> Agendado
        </span>
      </div>
    </section>
  );
}

export function OccupancyCard({ data, day }: { data: Store; day: string }) {
  const rows = occupancy(data, day);
  return (
    <section className="ov-card ov-occupancy" aria-labelledby="ov-occ-title">
      <div className="ov-card-head">
        <h2 id="ov-occ-title">Ocupação da equipe</h2>
        <Link href={`/dashboard/agenda?date=${day}`}>Ver agenda</Link>
      </div>
      {rows.length ? (
        <ul role="list">
          {rows.map(({ professional: p, count, ratio }, index) => (
            <li key={p.id}>
              <Avatar name={p.name} src={p.photo} size={34} />
              <div>
                <span className="ov-occ-name">
                  <strong>{p.name.split(" ")[0]}</strong>
                  <small>
                    {count} {count === 1 ? "atendimento" : "atendimentos"}
                  </small>
                  <b>{Math.round(ratio * 100)}%</b>
                </span>
                <span className="ov-occ-track">
                  <span
                    className={ratio >= 0.85 ? "is-full" : ""}
                    style={{
                      width: `${ratio * 100}%`,
                      animationDelay: `${index * 80}ms`,
                    }}
                  />
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ov-muted">Ninguém da equipe trabalha neste dia.</p>
      )}
    </section>
  );
}

export function AttentionCard({
  data,
  now,
  canEdit,
  onOpen,
}: {
  data: Store;
  now: number;
  canEdit: boolean;
  onOpen: (a: Appointment) => void;
}) {
  const { run, busyId } = useQuickStatus();
  const items = attention(data, now);
  if (!items.pendingTotal && !items.lapsedTotal) return null;
  const pageUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/${data.business.slug}`;
  return (
    <section className="ov-card ov-attention" aria-labelledby="ov-att-title">
      <div className="ov-card-head">
        <h2 id="ov-att-title">
          <WarningCircle size={18} weight="duotone" /> Precisa da sua atenção
        </h2>
      </div>
      {items.pendingTotal > 0 && (
        <div className="ov-att-group">
          <h3>
            {items.pendingTotal}{" "}
            {items.pendingTotal === 1
              ? "agendamento aguardando"
              : "agendamentos aguardando"}{" "}
            confirmação
          </h3>
          <ul role="list">
            {items.pending.map((a) => (
              <li key={a.id}>
                <button className="ov-att-open" onClick={() => onOpen(a)}>
                  <strong>{a.customerName}</strong>
                  <span>{dateLabel(a.start, "EEE, dd/MM 'às' HH:mm")}</span>
                </button>
                {canEdit && (
                  <button
                    className="ov-att-action sf-press"
                    disabled={busyId === a.id}
                    onClick={() => void run(a, "confirmed")}
                  >
                    <SealCheck size={16} weight="bold" />
                    {busyId === a.id ? "…" : "Confirmar"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {items.lapsedTotal > 0 && (
        <div className="ov-att-group">
          <h3>
            {items.lapsedTotal}{" "}
            {items.lapsedTotal === 1 ? "cliente sumido" : "clientes sumidos"}
          </h3>
          <ul role="list">
            {items.lapsed.map(({ customer: c, days }) => (
              <li key={c.id}>
                <Link
                  className="ov-att-open"
                  href={`/dashboard/clientes?q=${encodeURIComponent(c.name)}`}
                >
                  <strong>{c.name}</strong>
                  <span>
                    há {days} dias · costuma voltar a cada {c.returnInterval}{" "}
                    dias
                  </span>
                </Link>
                <a
                  className="ov-att-action is-whatsapp sf-press"
                  href={whatsappLink(
                    c.phone,
                    `Oi, ${c.name.split(" ")[0]}! Aqui é da ${data.business.name}. Sentimos sua falta. Quer agendar seu próximo horário? ${pageUrl}`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <WhatsAppIcon size={16} /> Chamar
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link className="ov-att-more" href="/dashboard/clientes">
        Ver todos os clientes <ArrowRight size={14} weight="bold" />
      </Link>
    </section>
  );
}

/** Real customer reviews: average, count and the latest comments. */
export function ReviewsCard({ data }: { data: Store }) {
  const reviews = data.reviews ?? [];
  const summary = ratingSummary(reviews);
  const latest = reviews.slice(0, 3);
  return (
    <section className="ov-card ov-reviews" aria-labelledby="ov-rev-title">
      <div className="ov-card-head">
        <h2 id="ov-rev-title">Avaliações dos clientes</h2>
      </div>
      {summary ? (
        <>
          <div className="ov-rev-score">
            <strong>{ratingLabel(summary)}</strong>
            <span>
              <span className="ov-rev-stars" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={15}
                    weight={
                      star <= Math.round(summary.average) ? "fill" : "regular"
                    }
                  />
                ))}
              </span>
              <small>
                {summary.count}{" "}
                {summary.count === 1 ? "avaliação" : "avaliações"}
              </small>
            </span>
          </div>
          <ul role="list">
            {latest.map((review) => {
              const person = data.professionals.find(
                (item) => item.id === review.professionalId,
              );
              return (
                <li key={review.id}>
                  <span className="ov-rev-head">
                    <strong>{review.customerName}</strong>
                    <span className="ov-rev-badge">
                      <Star size={12} weight="fill" /> {review.rating}
                    </span>
                    <small>
                      {person ? `com ${person.name.split(" ")[0]} · ` : ""}
                      {dateLabel(review.createdAt)}
                    </small>
                  </span>
                  {review.comment && <p>“{review.comment}”</p>}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="ov-muted">
          Quando você conclui um atendimento, o cliente pode dar uma nota pelo
          link do comprovante. A média aparece na sua página.
        </p>
      )}
    </section>
  );
}
