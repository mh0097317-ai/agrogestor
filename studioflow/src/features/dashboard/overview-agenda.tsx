"use client";
import { useState } from "react";
import Link from "next/link";
import { addDays, parseISO } from "date-fns";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { Avatar, EmptyState, StatusBadge } from "@/components/ui";
import { businessDay, dateLabel, localDay } from "@/lib/utils";
import type { Appointment, Store } from "@/types";
export function OverviewAgenda({
  data,
  rows,
  date,
  professional,
  onProfessional,
  onDate,
  onSelect,
}: {
  data: Store;
  rows: Appointment[];
  date: Date;
  professional: string;
  onProfessional: (id: string) => void;
  onDate: (date: Date) => void;
  onSelect: (a: Appointment) => void;
}) {
  const [all, setAll] = useState(false);
  const day = localDay(date);
  return (
    <section className="overview-agenda">
      <div className="overview-section-title">
        <div>
          <span className="overview-eyebrow">CADA HORÁRIO, UMA HISTÓRIA</span>
          <h2>
            {day === businessDay() ? "A agenda de hoje" : "A agenda do dia"}
            <span className="overview-count">{rows.length}</span>
          </h2>
        </div>
        <Link href={`/dashboard/agenda?date=${day}`}>
          Agenda completa <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="overview-agenda-tools">
        <div className="overview-day-picker">
          <button
            aria-label="Dia anterior"
            onClick={() => {
              onDate(addDays(date, -1));
              setAll(false);
            }}
          >
            <ChevronLeft size={17} />
          </button>
          <label>
            <CalendarDays size={16} />
            <span>{dateLabel(date, "d 'de' MMMM")}</span>
            <input
              aria-label="Data da agenda"
              type="date"
              value={day}
              onChange={(e) => {
                if (e.target.value) {
                  onDate(parseISO(e.target.value));
                  setAll(false);
                }
              }}
            />
          </label>
          <button
            aria-label="Próximo dia"
            onClick={() => {
              onDate(addDays(date, 1));
              setAll(false);
            }}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <select
          aria-label="Filtrar profissional"
          value={professional}
          onChange={(e) => onProfessional(e.target.value)}
        >
          <option value="all">Todos os profissionais</option>
          {data.professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {rows.length ? (
        <div className="overview-agenda-rows">
          <div className="overview-row-labels">
            <span>Horário</span>
            <span>Cliente / serviço</span>
            <span>Profissional</span>
            <span>Status</span>
            <span />
          </div>
          {(all ? rows : rows.slice(0, 6)).map((a) => (
            <button
              key={a.id}
              className="overview-appointment-row"
              onClick={() => onSelect(a)}
            >
              <span className="overview-row-time">
                {dateLabel(a.start, "HH:mm")}
                <small>{dateLabel(a.end, "HH:mm")}</small>
              </span>
              <span className="overview-row-customer">
                <Avatar name={a.customerName} size={36} />
                <span>
                  <strong>{a.customerName}</strong>
                  <small>
                    {a.serviceIds
                      .map((id) => data.services.find((s) => s.id === id)?.name)
                      .join(" + ")}
                  </small>
                </span>
              </span>
              <span className="overview-row-professional">
                {
                  data.professionals
                    .find((p) => p.id === a.professionalId)
                    ?.name.split(" ")[0]
                }
              </span>
              <StatusBadge status={a.status} />
              <ChevronRight size={17} />
            </button>
          ))}
          {rows.length > 6 && !all && (
            <button className="overview-show-all" onClick={() => setAll(true)}>
              Ver os {rows.length} agendamentos <ChevronRight size={16} />
            </button>
          )}
        </div>
      ) : (
        <EmptyState
          title="Espaço para um novo cuidado."
          description="Nenhum atendimento encontrado para esta data e profissional."
        />
      )}
    </section>
  );
}
