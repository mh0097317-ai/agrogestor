"use client";
import { useState } from "react";
import Link from "next/link";
import { addDays } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Plus,
} from "lucide-react";
import { Avatar, Button, EmptyState, StatusBadge } from "@/components/ui";
import { businessDay, dateLabel, localDay } from "@/lib/utils";
import type { Appointment, Store } from "@/types";

const views = [
  { id: "day", label: "Dia" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
];

export function OverviewAgenda({
  data,
  rows,
  date,
  onDate,
  onSelect,
  onCreate,
}: {
  data: Store;
  rows: Appointment[];
  date: Date;
  onDate: (date: Date) => void;
  onSelect: (a: Appointment) => void;
  onCreate?: () => void;
}) {
  const [all, setAll] = useState(false);
  const day = localDay(date);
  const isToday = day === businessDay();
  const visible = all ? rows : rows.slice(0, 8);
  function move(offset: number) {
    onDate(addDays(date, offset));
    setAll(false);
  }
  return (
    <section className="ov-card ov-agenda" aria-labelledby="ov-agenda-title">
      <div className="ov-agenda-tools">
        <div className="ov-day-nav">
          <button aria-label="Dia anterior" onClick={() => move(-1)}>
            <ChevronLeft size={17} />
          </button>
          <h2 id="ov-agenda-title">
            {isToday ? "Hoje, " : ""}
            {dateLabel(date, isToday ? "d 'de' MMMM" : "EEE, d 'de' MMMM")}
          </h2>
          <button aria-label="Próximo dia" onClick={() => move(1)}>
            <ChevronRight size={17} />
          </button>
        </div>
        <nav className="ov-views" aria-label="Abrir agenda">
          {views.map((view) => (
            <Link
              key={view.id}
              href={`/dashboard/agenda?view=${view.id}&date=${day}`}
              className={view.id === "day" ? "is-active" : ""}
              aria-current={view.id === "day" ? "page" : undefined}
            >
              {view.label}
            </Link>
          ))}
        </nav>
        {onCreate && (
          <Button onClick={onCreate}>
            <Plus size={16} /> Novo agendamento
          </Button>
        )}
      </div>
      {rows.length ? (
        <div className="ov-table" role="table" aria-label="Agendamentos do dia">
          <div className="ov-table-head" role="row">
            <span role="columnheader">Horário</span>
            <span role="columnheader">Cliente</span>
            <span role="columnheader">Serviço</span>
            <span role="columnheader">Profissional</span>
            <span role="columnheader">Status</span>
            <span role="columnheader" className="ov-table-actions">
              Ações
            </span>
          </div>
          {visible.map((a) => {
            const person = data.professionals.find(
              (p) => p.id === a.professionalId,
            );
            return (
              <button
                key={a.id}
                className="ov-table-row"
                role="row"
                onClick={() => onSelect(a)}
                aria-label={`${dateLabel(a.start, "HH:mm")}, ${a.customerName}. Abrir agendamento`}
              >
                <span role="cell" className="ov-cell-time">
                  {dateLabel(a.start, "HH:mm")}
                </span>
                <span role="cell" className="ov-cell-customer">
                  <Avatar name={a.customerName} size={30} />
                  <strong>{a.customerName}</strong>
                </span>
                <span role="cell" className="ov-cell-muted">
                  {a.serviceIds
                    .map((id) => data.services.find((s) => s.id === id)?.name)
                    .filter(Boolean)
                    .join(" + ")}
                </span>
                <span role="cell" className="ov-cell-person">
                  {person && (
                    <>
                      <Avatar name={person.name} src={person.photo} size={24} />
                      {person.name.split(" ")[0]}
                    </>
                  )}
                </span>
                <span role="cell">
                  <StatusBadge status={a.status} />
                </span>
                <span role="cell" className="ov-table-actions">
                  <EllipsisVertical size={17} />
                </span>
              </button>
            );
          })}
          {rows.length > visible.length && (
            <button className="ov-show-all" onClick={() => setAll(true)}>
              Ver os {rows.length} agendamentos <ChevronRight size={16} />
            </button>
          )}
        </div>
      ) : (
        <EmptyState
          title="Nenhum agendamento neste dia."
          description="Crie um agendamento ou compartilhe sua página com os clientes."
          action={
            onCreate && (
              <Button variant="secondary" onClick={onCreate}>
                <Plus size={16} /> Novo agendamento
              </Button>
            )
          }
        />
      )}
    </section>
  );
}
