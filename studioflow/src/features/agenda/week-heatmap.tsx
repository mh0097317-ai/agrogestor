"use client";
import { Fragment, type CSSProperties } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Lightbulb } from "@phosphor-icons/react/dist/ssr";
import type { Professional, Store } from "@/types";
import { weakSpot, weekHeat } from "./agenda-insights";

const level = (share: number | null) =>
  share === null
    ? "off"
    : share < 0.1
      ? "0"
      : share < 0.3
        ? "1"
        : share < 0.55
          ? "2"
          : share < 0.8
            ? "3"
            : "4";

/** How full each hour of the week is, and where the agenda is weakest. */
export function WeekHeatmap({
  data,
  days,
  professionals,
  today,
  onSelect,
}: {
  data: Store;
  days: Date[];
  professionals: Professional[];
  today: string;
  onSelect: (date: Date) => void;
}) {
  const heat = weekHeat(data, days, professionals);
  if (!heat.rows.length || !heat.hours.length) return null;
  const spot = weakSpot(data, heat, today);
  return (
    <section className="calendar-heat" aria-label="Ocupação da semana">
      <div className="calendar-heat-card">
        <header>
          <h3>Ocupação da semana</h3>
          <span>Quanto das cadeiras já está marcado, hora a hora.</span>
        </header>
        <div className="calendar-heat-scroll">
          <div
            className="calendar-heat-grid"
            style={{ "--heat-hours": heat.hours.length } as CSSProperties}
          >
            <span />
            {heat.hours.map((hour) => (
              <span className="calendar-heat-hour" key={hour}>
                {hour}h
              </span>
            ))}
            {heat.rows.map((row) => (
              <Fragment key={row.date.toISOString()}>
                <button
                  type="button"
                  className="calendar-heat-day"
                  onClick={() => onSelect(row.date)}
                  aria-label={`Abrir ${format(row.date, "EEEE, dd 'de' MMMM", { locale: ptBR })}`}
                >
                  <strong>
                    {format(row.date, "EEE", { locale: ptBR }).replace(".", "")}
                  </strong>
                  <span>{format(row.date, "dd/MM")}</span>
                </button>
                {row.cells.map((share, i) => (
                  <span
                    key={heat.hours[i]}
                    className="calendar-heat-cell"
                    data-level={level(share)}
                    title={
                      share === null
                        ? `${heat.hours[i]}h · fechado`
                        : `${heat.hours[i]}h · ${Math.round(share * 100)}% ocupado`
                    }
                  >
                    {share === null ? "" : `${Math.round(share * 100)}%`}
                  </span>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
        <div className="calendar-heat-scale" aria-hidden="true">
          <span>Vazio</span>
          {["0", "1", "2", "3", "4"].map((value) => (
            <i key={value} data-level={value} />
          ))}
          <span>Lotado</span>
        </div>
      </div>
      <aside className="calendar-heat-insight">
        <span className="calendar-eyebrow">
          <Lightbulb size={15} weight="duotone" /> O que a agenda está dizendo
        </span>
        {spot ? (
          <>
            <strong>{spot.title}</strong>
            <p>{spot.detail}</p>
            <Link
              href="/dashboard/clientes?filtro=retorno"
              className="btn btn-secondary"
            >
              Ver clientes que sumiram <ArrowRight size={16} />
            </Link>
          </>
        ) : (
          <>
            <strong>Semana bem ocupada.</strong>
            <p>
              Nenhum período ficou com menos da metade das cadeiras marcadas.
            </p>
          </>
        )}
      </aside>
    </section>
  );
}
